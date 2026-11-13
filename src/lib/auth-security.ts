// Small helpers for session and account security. They have no React or Supabase imports, so they
// can be tested on their own.

/** Defaults for evaluateIdle. The app does not sign people out for inactivity; it locks (see below). */
export const IDLE_LIMIT_MS = 30 * 60 * 1000;
export const IDLE_WARNING_MS = 2 * 60 * 1000;
/** Old key from the first version of this update. Still removed at sign-out. */
export const LAST_ACTIVE_KEY = 'femcare_last_active';
/** The app locks (the passphrase is needed again, the person stays signed in) after this long without use. */
export const LOCK_AFTER_MS = 5 * 60 * 1000;

/** Device-only copies that are removed at sign-out and account deletion (location caches and the like). */
export const LOCAL_DATA_KEYS = [
  'femcare_last_position_v1',
  'femcare_nearby_saved_v1',
  'femcare_cached_places',
  LAST_ACTIVE_KEY,
];

export type AuthNotice = 'idle_timeout' | 'session_expired' | 'signed_out_everywhere' | 'account_deleted';

export type IdleState = 'active' | 'warning' | 'expired';

export function evaluateIdle(now: number, lastActive: number, limitMs = IDLE_LIMIT_MS, warnMs = IDLE_WARNING_MS): IdleState {
  const idle = now - lastActive;
  if (idle < 0) return 'active'; // the clock moved backwards: do not sign out because of it
  if (idle >= limitMs) return 'expired';
  if (idle >= limitMs - warnMs) return 'warning';
  return 'active';
}

export function shouldLock(now: number, lastActive: number, limitMs = LOCK_AFTER_MS): boolean {
  return evaluateIdle(now, lastActive, limitMs, 0) === 'expired';
}

export function readLastActive(storage: Pick<Storage, 'getItem'>): number | null {
  try {
    const raw = storage.getItem(LAST_ACTIVE_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function writeLastActive(storage: Pick<Storage, 'setItem'>, now: number): void {
  try {
    storage.setItem(LAST_ACTIVE_KEY, String(now));
  } catch {
    /* storage unavailable: the in-memory timer still works */
  }
}

export type AuthMessageKey =
  | 'somethingWentWrong'
  | 'atLeast6Chars'
  | 'authInvalidCredentials'
  | 'authEmailNotConfirmed'
  | 'authNetworkError'
  | 'authRateLimited'
  | 'authSessionExpired'
  | 'authIdleTimeout'
  | 'authSignedOutEverywhere'
  | 'authAccountDeleted';

/**
 * Turns a raw backend message into a short, translated message. The raw text is never shown:
 * it can reveal whether an email is registered or other internal details.
 */
export function describeAuthError(raw: string | null | undefined, t: (key: AuthMessageKey) => string): string {
  const m = (raw ?? '').toLowerCase();
  if (!m) return t('somethingWentWrong');
  if (m.includes('invalid login') || m.includes('invalid credentials')) return t('authInvalidCredentials');
  if (m.includes('email not confirmed')) return t('authEmailNotConfirmed');
  if (m.includes('rate limit') || m.includes('too many')) return t('authRateLimited');
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed') || m.includes('timed out') || m.includes('timeout')) {
    return t('authNetworkError');
  }
  if (m.includes('password should be')) return t('atLeast6Chars');
  return t('somethingWentWrong');
}

export function noticeMessageKey(notice: AuthNotice): AuthMessageKey {
  switch (notice) {
    case 'idle_timeout': return 'authIdleTimeout';
    case 'signed_out_everywhere': return 'authSignedOutEverywhere';
    case 'account_deleted': return 'authAccountDeleted';
    default: return 'authSessionExpired';
  }
}

export interface SessionAuth {
  signOut(options: { scope: 'local' | 'global' }): Promise<{ error: unknown }>;
}

/**
 * Ends the login on this device. supabase-js leaves the session in storage when the server cannot be
 * reached (for example offline), so the stored session is always removed here as well.
 * serverConfirmed is false when the server could not be told (the refresh token stays valid there).
 */
export async function endSession(
  auth: SessionAuth,
  scope: 'local' | 'global',
  storage: Pick<Storage, 'removeItem'>,
  storageKey: string
): Promise<{ serverConfirmed: boolean }> {
  let serverConfirmed = false;
  try {
    const { error } = await auth.signOut({ scope });
    serverConfirmed = !error;
  } catch {
    serverConfirmed = false;
  }
  try {
    storage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
  return { serverConfirmed };
}

export function wipeLocalKeys(storage: Pick<Storage, 'removeItem'>, keys: string[] = LOCAL_DATA_KEYS): void {
  for (const k of keys) {
    try {
      storage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}

export function isDeleteConfirmed(typed: string, word: string): boolean {
  const a = typed.trim().toLocaleLowerCase();
  const b = word.trim().toLocaleLowerCase();
  return a.length > 0 && a === b;
}

export type DeleteError = 'wrong_password' | 'offline' | 'expired' | 'failed';

export function classifyDeleteError(message: string | undefined, step: 'password' | 'delete'): DeleteError {
  const m = (message ?? '').toLowerCase();
  const network = m.includes('failed to fetch') || m.includes('network') || m.includes('load failed') || m.includes('timed out') || m.includes('timeout');
  if (network) return 'offline';
  if (step === 'password') return m.includes('invalid login') || m.includes('invalid credentials') ? 'wrong_password' : 'failed';
  if (m.includes('not_authenticated') || m.includes('jwt')) return 'expired';
  return 'failed';
}
