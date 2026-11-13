import { describe, it, expect, vi } from 'vitest';
import {
  IDLE_LIMIT_MS, IDLE_WARNING_MS, LAST_ACTIVE_KEY, LOCAL_DATA_KEYS,
  evaluateIdle, shouldLock, LOCK_AFTER_MS, readLastActive, writeLastActive, describeAuthError, noticeMessageKey,
  endSession, wipeLocalKeys, isDeleteConfirmed, classifyDeleteError,
} from './auth-security';

const t = (key: string) => 'T:' + key;
const MIN = 60 * 1000;

describe('idle timeout', () => {
  it('is active while the person is using the app', () => {
    expect(evaluateIdle(10 * MIN, 0)).toBe('active');
    expect(evaluateIdle(IDLE_LIMIT_MS - IDLE_WARNING_MS - 1, 0)).toBe('active');
  });
  it('warns shortly before the limit', () => {
    expect(evaluateIdle(IDLE_LIMIT_MS - IDLE_WARNING_MS, 0)).toBe('warning');
    expect(evaluateIdle(IDLE_LIMIT_MS - 1, 0)).toBe('warning');
  });
  it('expires at the limit and after it, for example after reopening the app', () => {
    expect(evaluateIdle(IDLE_LIMIT_MS, 0)).toBe('expired');
    expect(evaluateIdle(5 * IDLE_LIMIT_MS, 0)).toBe('expired');
  });
  it('does not sign out when the clock moves backwards', () => {
    expect(evaluateIdle(1000, 5000)).toBe('active');
  });
  it('stores and reads the last activity time, and ignores bad values', () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(readLastActive(storage)).toBeNull();
    writeLastActive(storage, 12345);
    expect(readLastActive(storage)).toBe(12345);
    mem.set(LAST_ACTIVE_KEY, 'abc');
    expect(readLastActive(storage)).toBeNull();
    mem.set(LAST_ACTIVE_KEY, '-5');
    expect(readLastActive(storage)).toBeNull();
  });
  it('keeps working when storage throws', () => {
    const broken = { getItem: () => { throw new Error('no'); }, setItem: () => { throw new Error('no'); } };
    expect(readLastActive(broken)).toBeNull();
    writeLastActive(broken, 1);
  });
});

describe('app lock after inactivity', () => {
  it('locks after the limit, for example when the app was in the background', () => {
    expect(shouldLock(LOCK_AFTER_MS, 0)).toBe(true);
    expect(shouldLock(10 * LOCK_AFTER_MS, 0)).toBe(true);
  });
  it('does not lock while the person is using the app', () => {
    expect(shouldLock(LOCK_AFTER_MS - 1, 0)).toBe(false);
    expect(shouldLock(1000, 900)).toBe(false);
  });
  it('does not lock when the clock moves backwards', () => {
    expect(shouldLock(1000, 5000)).toBe(false);
  });
  it('locks after 5 minutes by default, far shorter than a sign-out would be', () => {
    expect(LOCK_AFTER_MS).toBe(5 * 60 * 1000);
    expect(shouldLock(LOCK_AFTER_MS - 1, 0, 10 * 1000)).toBe(true); // a shorter custom limit
  });
});

describe('authentication messages', () => {
  it('maps known failures to friendly messages', () => {
    expect(describeAuthError('Invalid login credentials', t)).toBe('T:authInvalidCredentials');
    expect(describeAuthError('Email not confirmed', t)).toBe('T:authEmailNotConfirmed');
    expect(describeAuthError('email rate limit exceeded', t)).toBe('T:authRateLimited');
    expect(describeAuthError('TypeError: Failed to fetch', t)).toBe('T:authNetworkError');
    expect(describeAuthError('Password should be at least 6 characters', t)).toBe('T:atLeast6Chars');
  });
  it('never shows raw backend text, such as an email address', () => {
    const out = describeAuthError('User someone@example.com not found in database table auth.users', t);
    expect(out).toBe('T:somethingWentWrong');
    expect(out.includes('someone@example.com')).toBe(false);
    expect(describeAuthError(undefined, t)).toBe('T:somethingWentWrong');
  });
  it('has a message for every notice', () => {
    expect(noticeMessageKey('idle_timeout')).toBe('authIdleTimeout');
    expect(noticeMessageKey('session_expired')).toBe('authSessionExpired');
    expect(noticeMessageKey('signed_out_everywhere')).toBe('authSignedOutEverywhere');
    expect(noticeMessageKey('account_deleted')).toBe('authAccountDeleted');
  });
});

describe('ending a session', () => {
  it('removes the stored session when the server confirms', async () => {
    const removed: string[] = [];
    const auth = { signOut: vi.fn(async () => ({ error: null })) };
    const r = await endSession(auth, 'local', { removeItem: (k) => void removed.push(k) }, 'sb-key');
    expect(r.serverConfirmed).toBe(true);
    expect(removed).toEqual(['sb-key']);
  });
  it('still removes the stored session when the server cannot be reached (offline)', async () => {
    const removed: string[] = [];
    const auth = { signOut: vi.fn(async () => ({ error: new Error('Failed to fetch') })) };
    const r = await endSession(auth, 'local', { removeItem: (k) => void removed.push(k) }, 'sb-key');
    expect(r.serverConfirmed).toBe(false);
    expect(removed).toEqual(['sb-key']);
  });
  it('still removes the stored session when sign-out throws', async () => {
    const removed: string[] = [];
    const auth = { signOut: async () => { throw new Error('boom'); } };
    const r = await endSession(auth, 'global', { removeItem: (k) => void removed.push(k) }, 'sb-key');
    expect(r.serverConfirmed).toBe(false);
    expect(removed).toEqual(['sb-key']);
  });
  it('passes the requested scope on', async () => {
    const auth = { signOut: vi.fn(async (_o: { scope: 'local' | 'global' }) => ({ error: null })) };
    await endSession(auth, 'global', { removeItem: () => undefined }, 'k');
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });
});

describe('local data cleanup', () => {
  it('removes every listed device copy, including location caches', () => {
    const mem = new Map<string, string>(LOCAL_DATA_KEYS.map((k) => [k, 'x']));
    mem.set('femcare_lang', 'hi');
    wipeLocalKeys({ removeItem: (k) => void mem.delete(k) });
    for (const k of LOCAL_DATA_KEYS) expect(mem.has(k)).toBe(false);
    expect(mem.get('femcare_lang')).toBe('hi'); // language preference is not personal data
  });
  it('keeps going when one removal throws', () => {
    const calls: string[] = [];
    wipeLocalKeys({ removeItem: (k) => { calls.push(k); throw new Error('no'); } }, ['a', 'b']);
    expect(calls).toEqual(['a', 'b']);
  });
});

describe('account deletion safeguards', () => {
  it('needs the confirmation word typed', () => {
    expect(isDeleteConfirmed('delete', 'DELETE')).toBe(true);
    expect(isDeleteConfirmed('  DELETE ', 'DELETE')).toBe(true);
    expect(isDeleteConfirmed('', 'DELETE')).toBe(false);
    expect(isDeleteConfirmed('del', 'DELETE')).toBe(false);
  });
  it('classifies failures', () => {
    expect(classifyDeleteError('Invalid login credentials', 'password')).toBe('wrong_password');
    expect(classifyDeleteError('Failed to fetch', 'password')).toBe('offline');
    expect(classifyDeleteError('not_authenticated', 'delete')).toBe('expired');
    expect(classifyDeleteError('reauth_required', 'delete')).toBe('failed');
    expect(classifyDeleteError('anything else', 'delete')).toBe('failed');
  });
});
