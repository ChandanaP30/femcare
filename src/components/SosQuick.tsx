import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { MapPin, Phone, ShieldCheck, X } from 'lucide-react';
import { supabase, AUTH_STORAGE_KEY } from '@/lib/supabase';
import { readCachedSessionUser } from '@/lib/offline';
import { useLanguage } from '@/lib/language-context';
import { sosText, type SosKey } from '@/lib/sos-i18n';
import { clearNative, saveNativeFix, syncNativeContacts } from '@/lib/sosNative';
import {
  SOS_OPEN_EVENT, acquireLocation, buildMessage, cleanPhone, isSosLink, maskPhone,
  normalizeContacts, readMirrorContacts, smsUri,
  type LocationResult, type SosContact,
} from '@/lib/sos';

const LAUNCH_KEY = 'femcare_sos_launch_handled';

/**
 * Sits above the passphrase gate, so SOS works without unlocking FemCare+.
 * It reads only emergency contacts from the offline mirror and never sends anything itself.
 */
export function SosQuickHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [runId, setRunId] = useState(0);
  const lastRef = useRef(0);
  const { lang } = useLanguage();

  const trigger = useCallback(() => {
    const now = Date.now();
    if (now - lastRef.current < 3000) return;
    lastRef.current = now;
    setRunId((n) => n + 1);
    setOpen(true);
  }, []);

  // Keep the native copy of contacts (used by the widget and lock-screen button) in step with the mirror.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cleared = false;
    const sync = () => {
      const uid = readCachedSessionUser<{ id: string }>(AUTH_STORAGE_KEY)?.id ?? null;
      if (!uid) {
        if (!cleared) { cleared = true; void clearNative(); }
        return;
      }
      cleared = false;
      const list = readMirrorContacts(uid);
      if (list) void syncNativeContacts(list, lang);
    };
    sync();
    const timer = window.setInterval(sync, 10000);
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [lang]);

  useEffect(() => {
    let alive = true;
    let remove: (() => Promise<void>) | null = null;
    App.addListener('appUrlOpen', ({ url }) => { if (isSosLink(url)) trigger(); })
      .then((h) => { if (alive) remove = () => h.remove(); else void h.remove(); })
      .catch(() => {});
    if (Capacitor.isNativePlatform()) {
      App.getLaunchUrl()
        .then((r) => {
          if (!alive || !r?.url || !isSosLink(r.url)) return;
          try {
            if (sessionStorage.getItem(LAUNCH_KEY) === r.url) return;
            sessionStorage.setItem(LAUNCH_KEY, r.url);
          } catch { /* ignore */ }
          trigger();
        })
        .catch(() => {});
    }
    const onEvent = () => trigger();
    window.addEventListener(SOS_OPEN_EVENT, onEvent);
    return () => {
      alive = false;
      window.removeEventListener(SOS_OPEN_EVENT, onEvent);
      if (remove) void remove();
    };
  }, [trigger]);

  return (
    <>
      {children}
      {open && <SosPanel key={runId} onClose={() => setOpen(false)} />}
    </>
  );
}

function SosPanel({ onClose }: { onClose: () => void }) {
  const { lang } = useLanguage();
  const tx = (k: SosKey, p?: Record<string, string | number>) => sosText(lang, k, p);
  const [contacts, setContacts] = useState<SosContact[] | null>(null);
  const [loc, setLoc] = useState<LocationResult | null>(null);
  const [showOpen, setShowOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const autoRef = useRef(false);
  const leftRef = useRef(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const userId = readCachedSessionUser<{ id: string }>(AUTH_STORAGE_KEY)?.id ?? null;
      if (!userId) { if (alive) setContacts([]); return; }
      let list = readMirrorContacts(userId);
      if (list === null && typeof navigator !== 'undefined' && navigator.onLine !== false) {
        try {
          const res = await Promise.race([
            supabase.from('emergency_contacts').select('id, name, phone, created_at').eq('user_id', userId).order('created_at', { ascending: true }),
            new Promise<null>((r) => setTimeout(() => r(null), 4000)),
          ]);
          if (res && !res.error && Array.isArray(res.data)) list = normalizeContacts(res.data);
        } catch { /* fall through to an empty list */ }
      }
      if (alive) setContacts(list ?? []);
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    abortRef.current = ac;
    let alive = true;
    acquireLocation({ signal: ac.signal }).then((r) => { if (alive) setLoc(r); });
    return () => { alive = false; ac.abort(); };
  }, []);

  const body = useMemo(() => (loc ? buildMessage(loc.fix) : ''), [loc]);

  useEffect(() => { if (loc?.fix) void saveNativeFix(loc.fix); }, [loc]);

  useEffect(() => {
    if (!loc || contacts === null || autoRef.current) return;
    autoRef.current = true;
    if (contacts.length === 0) return;
    const onHide = () => { if (document.visibilityState === 'hidden') leftRef.current = true; };
    document.addEventListener('visibilitychange', onHide);
    window.location.href = smsUri(contacts[0].phone, body);
    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', onHide);
      if (!leftRef.current) setShowOpen(true);
    }, 2000);
  }, [loc, contacts, body]);

  const locText = !loc ? '' : loc.fix
    ? (loc.fix.accuracy !== null ? tx('locFound', { m: Math.round(loc.fix.accuracy) }) : tx('locFoundNoAcc'))
    : loc.reason === 'denied' ? tx('locDenied') : tx('locFailed');

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-bg dark:bg-bg-dark" role="dialog" aria-modal="true" aria-label={tx('title')}>
      <div className="mx-auto min-h-full max-w-[430px] space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h1 className="font-serif text-2xl text-ink">{tx('title')}</h1>
          <button type="button" onClick={onClose} aria-label={tx('close')} className="flex h-10 w-10 items-center justify-center rounded-full text-ink-muted hover:bg-primary-50 dark:hover:bg-white/5">
            <X size={20} />
          </button>
        </div>

        <a
          href="tel:112"
          aria-label="Call emergency number 112"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-error-300 px-5 py-4 text-lg font-semibold text-ink-onlight shadow-soft active:scale-[0.98]"
        >
          <Phone size={20} strokeWidth={2} />
          {tx('call112')}
        </a>

        <section className="card space-y-3 p-4">
          {!loc ? (
            <>
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
                <p className="text-sm text-ink">{tx('locating')}</p>
              </div>
              <button type="button" onClick={() => abortRef.current?.abort()} className="btn-secondary w-full">{tx('sendNow')}</button>
            </>
          ) : (
            <div className="flex items-start gap-3">
              <MapPin size={18} strokeWidth={1.75} className="mt-0.5 shrink-0 text-ink-muted" />
              <p className="text-sm text-ink">{locText}</p>
            </div>
          )}
        </section>

        {loc && (
          <>
            <section className="card space-y-2 p-4">
              <p className="text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">{tx('messagePreview')}</p>
              <p className="text-sm leading-relaxed text-ink">{body}</p>
            </section>

            {contacts !== null && contacts.length === 0 && (
              <section className="card space-y-3 p-4">
                <p className="text-sm text-ink-muted">{tx('noContacts')}</p>
                <a href={smsUri('', body)} className="btn-primary flex w-full items-center justify-center">{tx('writeMessage')}</a>
              </section>
            )}

            {contacts !== null && contacts.length > 0 && (
              <section className="space-y-3">
                {showOpen && (
                  <a href={smsUri(contacts[0].phone, body)} className="btn-primary flex w-full items-center justify-center">{tx('openMessage')}</a>
                )}
                {contacts.length > 1 && <p className="text-xs text-ink-muted">{tx('next')}</p>}
                {contacts.map((c) => (
                  <div key={c.id} className="card flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                      <p className="truncate text-xs text-ink-muted">{maskPhone(c.phone)}</p>
                    </div>
                    <a href={smsUri(c.phone, body)} className="rounded-full bg-primary-100 px-3.5 py-2 text-sm font-medium text-ink dark:bg-primary-900/50">{tx('message')}</a>
                    <a href={`tel:${cleanPhone(c.phone)}`} className="rounded-full bg-success-200 px-3.5 py-2 text-sm font-medium text-ink dark:bg-success-700/30">{tx('call')}</a>
                  </div>
                ))}
              </section>
            )}
          </>
        )}

        <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-muted">
          <ShieldCheck size={14} strokeWidth={1.75} className="mt-0.5 shrink-0" />
          {tx('sentHint')}
        </p>
        <button type="button" onClick={onClose} className="btn-ghost w-full">{tx('continueApp')}</button>
      </div>
    </div>
  );
}
