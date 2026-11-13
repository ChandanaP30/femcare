import { useCallback, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { AUTH_STORAGE_KEY } from '@/lib/supabase';
import { readCachedSessionUser } from '@/lib/offline';
import { useLanguage } from '@/lib/language-context';
import { sosText, type SosKey } from '@/lib/sos-i18n';
import { acquireLocation, readMirrorContacts } from '@/lib/sos';
import {
  SOS_AUTO_EVENT, getNativeStatus, requestNativeLocation, requestNativeSms, saveNativeFix,
  setNativeEnabled, setNativeLockButton, syncNativeContacts, type SosStatus,
} from '@/lib/sosNative';

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`flex h-7 w-12 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-40 ${checked ? 'bg-primary-500' : 'bg-primary-100 dark:bg-primary-900/40'}`}
    >
      <span className={`block h-6 w-6 rounded-full bg-white shadow transition-transform dark:bg-neutral-800 ${checked ? 'translate-x-5' : ''}`} />
    </button>
  );
}

/** Settings for the home-screen widget and the lock-screen button. Shown only inside the Android app. */
export function SosAutoSendCard() {
  const native = Capacitor.isNativePlatform();
  const { lang } = useLanguage();
  const tx = (k: SosKey, p?: Record<string, string | number>) => sosText(lang, k, p);
  const [status, setStatus] = useState<SosStatus | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => { setStatus(await getNativeStatus()); }, []);

  useEffect(() => {
    if (!native) return;
    let last = '';
    const tick = () => {
      const uid = readCachedSessionUser<{ id: string }>(AUTH_STORAGE_KEY)?.id;
      const list = uid ? readMirrorContacts(uid) : null;
      const key = JSON.stringify(list ?? []) + lang;
      if (list && key !== last) {
        last = key;
        void syncNativeContacts(list, lang).then(refresh);
      }
    };
    tick();
    void refresh();
    const id = window.setInterval(tick, 2000);
    return () => window.clearInterval(id);
  }, [native, lang, refresh]);

  if (!native) return null;

  async function toggleEnabled(next: boolean) {
    setMsg('');
    setBusy(true);
    try {
      if (!next) {
        await setNativeEnabled(false);
        return;
      }
      if (!window.confirm(tx('autoConsent'))) return;
      const s = await getNativeStatus();
      if (!s || s.contacts === 0) {
        setMsg(tx('autoNeedContacts'));
        return;
      }
      if (!(await requestNativeSms())) {
        setMsg(tx('autoNeedSms'));
        return;
      }
      await requestNativeLocation();
      await setNativeEnabled(true);
    } finally {
      setBusy(false);
      await refresh();
      window.dispatchEvent(new Event(SOS_AUTO_EVENT));
    }
  }

  async function toggleLock(next: boolean) {
    setMsg('');
    setBusy(true);
    try {
      if (next) {
        let display = (await LocalNotifications.checkPermissions()).display;
        if (display !== 'granted') display = (await LocalNotifications.requestPermissions()).display;
        if (display !== 'granted') {
          setMsg(tx('autoNotifPerm'));
          return;
        }
      }
      await setNativeLockButton(next);
    } finally {
      setBusy(false);
      await refresh();
    }
  }

  async function saveLocationNow() {
    setMsg('');
    setBusy(true);
    try {
      const r = await acquireLocation();
      if (r.fix) {
        await saveNativeFix(r.fix);
        setMsg(tx('autoSaved'));
      } else {
        setMsg(tx('autoNotSaved'));
      }
    } finally {
      setBusy(false);
    }
  }

  const enabled = !!status?.enabled;
  return (
    <section className="card space-y-3 p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="section-title">{tx('autoTitle')}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{tx('autoShort')}</p>
        </div>
        <Toggle checked={enabled} disabled={busy} onChange={(v) => void toggleEnabled(v)} label={tx('autoEnable')} />
      </div>
      {enabled && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-ink">{tx('autoLockShort')}</p>
            <Toggle checked={!!status?.lockButton} disabled={busy} onChange={(v) => void toggleLock(v)} label={tx('autoLock')} />
          </div>
          <button type="button" onClick={() => void saveLocationNow()} disabled={busy} className="btn-secondary w-full">
            {tx('autoSaveLoc')}
          </button>
        </>
      )}
      {msg && <p className="rounded-xl bg-accent-100 px-3 py-2 text-xs leading-relaxed text-ink dark:bg-accent-600/25">{msg}</p>}
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs font-medium text-ink underline">
        {open ? tx('detailsHide') : tx('detailsShow')}
      </button>
      {open && (
        <div className="space-y-2 text-xs leading-relaxed text-ink-muted">
          <p>{tx('autoDesc')}</p>
          <p>{tx('autoConsent')}</p>
          <p>{tx('autoContacts', { n: status?.contacts ?? 0 })}</p>
          {enabled && <p>{(status?.widgets ?? 0) > 0 ? tx('autoWidgetAdded') : tx('autoWidgetHint')}</p>}
          {enabled && <p>{tx('autoLockDesc')}</p>}
        </div>
      )}
    </section>
  );
}
