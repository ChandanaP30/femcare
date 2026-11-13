import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useCrypto } from '@/lib/crypto-context';
import { LOCK_AFTER_MS, shouldLock } from '@/lib/auth-security';

const CHECK_EVERY_MS = 10000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel'] as const;

// Only in `npm run dev`, a shorter time can be set for testing: localStorage.setItem('femcare_lock_ms', '10000')
function lockLimit(): number {
  if (import.meta.env.DEV) {
    const n = Number(localStorage.getItem('femcare_lock_ms'));
    if (Number.isFinite(n) && n >= 1000) return n;
  }
  return LOCK_AFTER_MS;
}

/**
 * Locks the app after a few minutes without use, or after it was in the background that long.
 * The person stays signed in and only enters their passphrase again (the existing lock screen).
 * Locking also forgets the encryption key held in memory.
 */
export function SessionGuard() {
  const { user } = useAuth();
  const { unlocked, lock } = useCrypto();
  const lastActive = useRef(Date.now());
  const lockRef = useRef(lock);
  lockRef.current = lock;
  const active = !!user && unlocked;

  useEffect(() => {
    if (!active) return;
    lastActive.current = Date.now();

    const check = () => {
      if (shouldLock(Date.now(), lastActive.current, lockLimit())) lockRef.current();
    };
    const touch = () => {
      const now = Date.now();
      // After the limit has passed, a touch must not extend it: the app locks first.
      if (shouldLock(now, lastActive.current, lockLimit())) {
        lockRef.current();
        return;
      }
      lastActive.current = now;
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') touch();
    };

    const id = window.setInterval(check, CHECK_EVERY_MS);
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    window.addEventListener('scroll', touch, { passive: true, capture: true });
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(id);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, touch));
      window.removeEventListener('scroll', touch, { capture: true });
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active]);

  return null;
}
