import { useRef, useState } from 'react';
import { Download, Upload, ShieldCheck, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import { getOfflineStatus } from '@/lib/offline';
import { bt, type BackupKey } from '@/lib/backup-text';
import { saveTextFile } from '@/lib/backup-files';
import {
  MIN_PASSPHRASE_LENGTH, parseBackup, type BackupData, type BackupCounts, type ParseErrorCode, type PlanSummary, type RestoreMode,
} from '@/lib/backup-core';
import {
  createBackup, makeSupabaseDb, prepareRestore, runRestore, type BackupDeps, type Connectivity, type RestoreResult,
} from '@/lib/backup-service';

type Step =
  | { s: 'idle' }
  | { s: 'export' }
  | { s: 'exporting' }
  | { s: 'exported'; name: string; counts: BackupCounts; prot: boolean }
  | { s: 'reading' }
  | { s: 'needpass'; text: string; wrong: boolean }
  | { s: 'choose'; file: BackupData; meta: { createdAt: string; encrypted: boolean; counts: BackupCounts }; merge: PlanSummary; replace: PlanSummary; local: BackupCounts }
  | { s: 'confirm'; file: BackupData; plan: PlanSummary }
  | { s: 'restoring' }
  | { s: 'restored'; result: Extract<RestoreResult, { ok: true }>; mode: RestoreMode };

const PARSE_ERR: Record<ParseErrorCode, BackupKey> = {
  empty: 'eEmpty', too_large: 'eTooLarge', not_json: 'eNotJson', wrong_format: 'eWrongFormat',
  unsupported_version: 'eUnsupported', newer_version: 'eNewer', needs_passphrase: 'passphraseNeeded',
  bad_passphrase: 'wrongPass', unsupported_kdf: 'eKdf', corrupt: 'eCorrupt', checksum_mismatch: 'eChecksum',
  invalid_data: 'eInvalid', crypto_unavailable: 'eCrypto',
};

const CONNECT_ERR: Record<string, BackupKey> = { offline: 'eOffline', pending_sync: 'ePending', read_failed: 'eRead' };

export function BackupRestore() {
  const { user } = useAuth();
  const { lang: appLang } = useLanguage();
  const lang = String(appLang || 'en');
  const t = (k: BackupKey, v?: Record<string, string | number>) => bt(lang, k, v);

  const [step, setStep] = useState<Step>({ s: 'idle' });
  const [error, setError] = useState('');
  const [protect, setProtect] = useState(true);
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [unlockPass, setUnlockPass] = useState('');
  const [word, setWord] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const deps = (): BackupDeps => ({
    db: makeSupabaseDb(supabase, user.id),
    userId: user.id,
    connectivity: (): Connectivity => {
      const st = getOfflineStatus();
      if (!st.online) return 'offline';
      if (st.pending > 0 || st.syncing) return 'pending_sync';
      return 'ok';
    },
  });

  const reset = () => { setStep({ s: 'idle' }); setError(''); setPass(''); setPass2(''); setUnlockPass(''); setWord(''); };

  const doExport = async () => {
    setError('');
    if (protect) {
      if (pass.length < MIN_PASSPHRASE_LENGTH) return setError(t('errShort', { n: MIN_PASSPHRASE_LENGTH }));
      if (pass !== pass2) return setError(t('errMismatch'));
    }
    setStep({ s: 'exporting' });
    const res = await createBackup(deps(), { passphrase: protect ? pass : undefined });
    if (!res.ok) {
      setStep({ s: 'export' });
      if (res.code === 'self_check_failed') return setError(t('eSelf'));
      if (res.code === 'crypto_unavailable') return setError(t('eCrypto'));
      return setError(t(CONNECT_ERR[res.code] ?? 'eFailed'));
    }
    const saved = await saveTextFile(res.filename, res.text);
    if (!saved.ok) {
      setStep({ s: 'export' });
      return setError(t(saved.reason === 'plugin' ? 'savePlugin' : 'saveFailed'));
    }
    setPass(''); setPass2('');
    setStep({ s: 'exported', name: res.filename, counts: res.counts, prot: res.protectedFile });
  };

  const inspect = async (text: string, passphrase?: string) => {
    const parsed = await parseBackup(text, passphrase);
    if (!parsed.ok) {
      if (parsed.code === 'needs_passphrase') { setStep({ s: 'needpass', text, wrong: false }); return; }
      if (parsed.code === 'bad_passphrase') { setStep({ s: 'needpass', text, wrong: true }); return; }
      setStep({ s: 'idle' });
      setError(t(PARSE_ERR[parsed.code]));
      return;
    }
    const prep = await prepareRestore(deps(), parsed.data);
    if (!prep.ok) { setStep({ s: 'idle' }); setError(t(CONNECT_ERR[prep.code] ?? 'eRead')); return; }
    setUnlockPass('');
    setStep({ s: 'choose', file: parsed.data, meta: parsed.meta, merge: prep.merge, replace: prep.replace, local: prep.local });
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setError('');
    setStep({ s: 'reading' });
    try {
      if (f.size > 25 * 1024 * 1024) { setStep({ s: 'idle' }); return setError(t('eTooLarge')); }
      await inspect(await f.text());
    } catch {
      setStep({ s: 'idle' });
      setError(t('eNotJson'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const doRestore = async (file: BackupData, mode: RestoreMode) => {
    setStep({ s: 'restoring' });
    const res = await runRestore(deps(), file, mode);
    if (!res.ok) {
      setStep({ s: 'idle' });
      const base = CONNECT_ERR[res.code] ?? 'eFailed';
      const tail = res.code === 'failed' ? ' ' + t(res.rolledBack ? 'eRolledBack' : 'eRollbackPartial') : '';
      return setError(t(base) + tail);
    }
    setWord('');
    setStep({ s: 'restored', result: res, mode });
  };

  const finish = () => {
    // Screens keep their own copies of the data, so reload to show the restored records.
    reset();
    window.location.reload();
  };

  const busy = step.s === 'exporting' || step.s === 'reading' || step.s === 'restoring';
  const sum = (p: PlanSummary) => p.total;
  const rows: { key: 'periods' | 'dailyLogs' | 'periodDayLogs' | 'symptoms'; label: BackupKey }[] = [
    { key: 'periods', label: 'rowPeriods' }, { key: 'dailyLogs', label: 'rowLogs' },
    { key: 'periodDayLogs', label: 'rowDayLogs' }, { key: 'symptoms', label: 'rowSymptoms' },
  ];

  const btn = 'rounded-xl px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50';
  const primary = `${btn} bg-primary-600 text-white hover:bg-primary-600/90`;
  const secondary = `${btn} border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800`;
  const input = 'w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 px-3 py-2.5 text-sm';

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">{t('title')}</h3>
      </div>
      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{t('intro')}</p>

      {error && (
        <div role="alert" className="flex gap-2 rounded-xl bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 p-3 text-sm text-error-600 dark:text-error-400 mb-3">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {step.s === 'idle' && (
        <>
          <div className="flex flex-col sm:flex-row gap-2">
            <button className={primary} onClick={() => { setError(''); setStep({ s: 'export' }); }}>
              <Download className="w-4 h-4 inline mr-1.5 -mt-0.5" />{t('exportBtn')}
            </button>
            <button className={secondary} onClick={() => { setError(''); fileRef.current?.click(); }}>
              <Upload className="w-4 h-4 inline mr-1.5 -mt-0.5" />{t('restoreBtn')}
            </button>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-3">{t('footnote')}</p>
        </>
      )}

      <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      {(step.s === 'export' || step.s === 'exporting') && (
        <div className="space-y-3">
          <label className="flex items-start gap-2 text-sm text-neutral-800 dark:text-neutral-200">
            <input type="checkbox" className="mt-1" checked={protect} disabled={busy} onChange={(e) => setProtect(e.target.checked)} />
            <span>{t('protectLabel')}</span>
          </label>
          {protect ? (
            <>
              <p className="text-xs text-neutral-600 dark:text-neutral-400">{t('protectHelp')}</p>
              <input type="password" autoComplete="new-password" className={input} placeholder={t('passphrase')} value={pass} disabled={busy} onChange={(e) => setPass(e.target.value)} />
              <input type="password" autoComplete="new-password" className={input} placeholder={t('passphraseConfirm')} value={pass2} disabled={busy} onChange={(e) => setPass2(e.target.value)} />
              <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('passphraseHint', { n: MIN_PASSPHRASE_LENGTH })}</p>
            </>
          ) : (
            <p className="text-xs rounded-lg bg-warning-100 dark:bg-warning-100/10 border border-warning-300 text-neutral-800 dark:text-neutral-200 p-2.5">{t('plainWarn')}</p>
          )}
          <div className="flex gap-2">
            <button className={primary} disabled={busy} onClick={doExport}>
              {step.s === 'exporting' ? <><Loader2 className="w-4 h-4 inline animate-spin mr-1.5" />{t('creating')}</> : t('createBackup')}
            </button>
            <button className={secondary} disabled={busy} onClick={reset}>{t('cancel')}</button>
          </div>
        </div>
      )}

      {step.s === 'exported' && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-success-600 dark:text-success-400 font-medium"><CheckCircle2 className="w-4 h-4" />{t('exportDone')}</div>
          <p>{t(step.prot ? 'exportDoneProtected' : 'exportDonePlain')}</p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 break-all">{t('savedAs', { name: step.name })}</p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">{t('exportSummary', { periods: step.counts.periods, logs: step.counts.dailyLogs, dayLogs: step.counts.periodDayLogs, symptoms: step.counts.symptoms })}</p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('shareHint')}</p>
          <button className={secondary} onClick={reset}>{t('done')}</button>
        </div>
      )}

      {step.s === 'reading' && <p className="text-sm text-neutral-600 dark:text-neutral-400"><Loader2 className="w-4 h-4 inline animate-spin mr-1.5" />{t('reading')}</p>}

      {step.s === 'needpass' && (
        <div className="space-y-3">
          <p className="text-sm text-neutral-800 dark:text-neutral-200">{t('passphraseNeeded')}</p>
          {step.wrong && <p className="text-sm text-error-600 dark:text-error-400">{t('wrongPass')}</p>}
          <input type="password" autoComplete="off" className={input} placeholder={t('passphrase')} value={unlockPass} onChange={(e) => setUnlockPass(e.target.value)} />
          <div className="flex gap-2">
            <button className={primary} disabled={!unlockPass} onClick={() => { const txt = step.text; setStep({ s: 'reading' }); inspect(txt, unlockPass); }}>{t('unlock')}</button>
            <button className={secondary} onClick={reset}>{t('cancel')}</button>
          </div>
        </div>
      )}

      {step.s === 'choose' && (
        <div className="space-y-3 text-sm">
          <p className="text-neutral-600 dark:text-neutral-400">{t('backupFrom', { date: step.meta.createdAt.slice(0, 10) })}</p>
          <table className="w-full text-left">
            <thead><tr className="text-xs text-neutral-500 dark:text-neutral-400"><th className="font-normal py-1" /><th className="font-normal">{t('inFile')}</th><th className="font-normal">{t('onDevice')}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-neutral-100 dark:border-neutral-800"><td className="py-1.5">{t(r.label)}</td><td>{step.meta.counts[r.key]}</td><td>{step.local[r.key]}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="font-medium text-neutral-900 dark:text-neutral-100 pt-1">{t('modeTitle')}</p>
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-3">
            <p className="font-medium">{t('mergeTitle')}</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{t('mergeDesc')}</p>
            <p className="text-xs text-neutral-800 dark:text-neutral-200 mt-1">{t('mergeResult', { a: sum(step.merge).insert, s: sum(step.merge).skipped + sum(step.merge).unchanged })}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t('profileMerge')}</p>
            <button className={`${primary} mt-2`} disabled={sum(step.merge).insert === 0 && !step.merge.profileChange && !step.merge.settingsChange}
              onClick={() => doRestore(step.file, 'merge')}>{t('restoreNow')}</button>
            {sum(step.merge).insert === 0 && !step.merge.profileChange && !step.merge.settingsChange && <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t('nothingNew')}</p>}
          </div>
          <div className="rounded-xl border border-error-200 dark:border-error-800 p-3">
            <p className="font-medium">{t('replaceTitle')}</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{t('replaceDesc')}</p>
            <p className="text-xs text-neutral-800 dark:text-neutral-200 mt-1">{t('replaceResult', { a: sum(step.replace).insert, u: sum(step.replace).update, r: sum(step.replace).remove })}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t('profileReplace')}</p>
            <button className={`${secondary} mt-2 border-error-300 text-error-600`} onClick={() => { setWord(''); setStep({ s: 'confirm', file: step.file, plan: step.replace }); }}>{t('continueBtn')}</button>
          </div>
          <button className={secondary} onClick={reset}>{t('cancel')}</button>
        </div>
      )}

      {step.s === 'confirm' && (
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-error-600 dark:text-error-400">{t('confirmReplaceTitle')}</p>
          <p>{t('confirmReplaceText', { n: step.plan.total.update + step.plan.total.remove + step.plan.total.insert, word: t('confirmWord') })}</p>
          <input className={input} autoCapitalize="characters" autoComplete="off" value={word} onChange={(e) => setWord(e.target.value)} />
          <div className="flex gap-2">
            <button className={`${btn} bg-error-600 text-white hover:bg-error-600/90`} disabled={word.trim().toUpperCase() !== t('confirmWord')} onClick={() => doRestore(step.file, 'replace')}>{t('replaceNow')}</button>
            <button className={secondary} onClick={reset}>{t('back')}</button>
          </div>
        </div>
      )}

      {step.s === 'restoring' && <p className="text-sm text-neutral-600 dark:text-neutral-400"><Loader2 className="w-4 h-4 inline animate-spin mr-1.5" />{t('restoring')}</p>}

      {step.s === 'restored' && (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-success-600 dark:text-success-400 font-medium"><CheckCircle2 className="w-4 h-4" />{t('restoredTitle')}</div>
          <p>{t('restoredLine', { a: step.result.total.inserted, u: step.result.total.updated, r: step.result.total.removed, s: step.result.total.skipped + step.result.total.unchanged })}</p>
          {step.result.removalFailed && <p className="text-neutral-800 dark:text-neutral-200">{t('restoredRemovalWarn')}</p>}
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('doneReload')}</p>
          <button className={primary} onClick={finish}>{t('done')}</button>
        </div>
      )}
    </div>
  );
}
