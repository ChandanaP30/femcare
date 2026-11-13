import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  acquireLocation, buildMessage, cleanPhone, isSosLink, maskPhone, normalizeContacts,
  readMirrorContacts, smsUri, MIRROR_PREFIX,
} from './sos';
import { SOS_TEXT } from './sos-i18n';

afterEach(() => { vi.useRealTimers(); });

describe('links and phones', () => {
  it('recognises only the SOS link', () => {
    expect(isSosLink('com.femcare.app://sos')).toBe(true);
    expect(isSosLink('com.femcare.app://sos?x=1')).toBe(true);
    expect(isSosLink('com.femcare.app://sos/')).toBe(true);
    expect(isSosLink('com.femcare.app://login-callback?code=1')).toBe(false);
    expect(isSosLink('https://example.com/sos')).toBe(false);
    expect(isSosLink('garbage')).toBe(false);
  });
  it('cleans and masks numbers', () => {
    expect(cleanPhone('+91 98765-43210')).toBe('+919876543210');
    expect(cleanPhone('(098) 765 4321')).toBe('0987654321');
    expect(maskPhone('+919876543210')).toBe('•••• 3210');
    expect(maskPhone('12')).toBe('••••');
  });
  it('builds sms links with an encoded body', () => {
    const u = smsUri('+91 98765 43210', 'SOS! a&b?c');
    expect(u.startsWith('sms:+919876543210?body=')).toBe(true);
    expect(u).not.toMatch(/[&?].*[&].*$/);
    expect(decodeURIComponent(u.split('body=')[1])).toBe('SOS! a&b?c');
    expect(smsUri('', 'x')).toBe('sms:?body=x');
  });
  it('builds the message with and without a location', () => {
    const t = new Date(2026, 0, 1, 9, 5);
    const m = buildMessage({ lat: 12.97164, lon: 77.59456, accuracy: 42.4 }, t);
    expect(m).toContain('https://maps.google.com/?q=12.971640,77.594560');
    expect(m).toContain('accuracy about 42 m');
    expect(m).toContain('09:05');
    expect(buildMessage({ lat: 1, lon: 2, accuracy: null }, t)).not.toContain('accuracy');
    expect(buildMessage(null)).toContain('could not get my location');
  });
});

describe('offline mirror contacts', () => {
  const store = (v: string | null) => ({ getItem: (k: string) => (k === MIRROR_PREFIX + 'u1' ? v : null) });
  it('is null when missing, corrupt or never downloaded', () => {
    expect(readMirrorContacts('u1', store(null))).toBeNull();
    expect(readMirrorContacts('u1', store('{oops'))).toBeNull();
    expect(readMirrorContacts('u1', store(JSON.stringify({ rows: {}, queue: [] })))).toBeNull();
    expect(readMirrorContacts('other', store('{}'))).toBeNull();
  });
  it('reads, filters and orders contacts', () => {
    const rows = [
      { id: 'b', name: 'B', phone: '+91 22222 22222', created_at: '2026-02-01' },
      { id: 'a', name: ' A ', phone: '+91 11111 11111', created_at: '2026-01-01' },
      { id: 'x', name: 'Bad', phone: '12' },
      null,
    ];
    const list = readMirrorContacts('u1', store(JSON.stringify({ rows: { emergency_contacts: rows } })))!;
    expect(list.map((c) => c.id)).toEqual(['a', 'b']);
    expect(list[0].name).toBe('A');
    expect(list[0].phone).toBe('+911111111111');
  });
  it('returns an empty list when the table was downloaded but is empty', () => {
    expect(readMirrorContacts('u1', store(JSON.stringify({ rows: { emergency_contacts: [] } })))).toEqual([]);
    expect(normalizeContacts('nope')).toEqual([]);
  });
});

function fakeGeo() {
  const h: { ok?: (p: GeolocationPosition) => void; err?: (e: GeolocationPositionError) => void; cleared: number } = { cleared: 0 };
  const geo = {
    getCurrentPosition: (ok: (p: GeolocationPosition) => void, err: (e: GeolocationPositionError) => void) => { h.ok = ok; h.err = err; },
    watchPosition: (ok: (p: GeolocationPosition) => void, err: (e: GeolocationPositionError) => void) => { h.ok = ok; h.err = err; return 1; },
    clearWatch: () => { h.cleared++; },
  } as unknown as Geolocation;
  return { geo, h };
}
const pos = (acc: number) => ({ coords: { latitude: 12.97, longitude: 77.59, accuracy: acc } }) as GeolocationPosition;
const err = (code: number) => ({ code }) as GeolocationPositionError;

describe('acquireLocation', () => {
  it('uses an accurate fix at once', async () => {
    const { geo, h } = fakeGeo();
    const p = acquireLocation({ geo });
    h.ok!(pos(30));
    const r = await p;
    expect(r.reason).toBe('ok');
    expect(r.fix?.accuracy).toBe(30);
    expect(h.cleared).toBeGreaterThan(0);
  });
  it('waits for the budget with a poor fix and returns the best one', async () => {
    vi.useFakeTimers();
    const { geo, h } = fakeGeo();
    const p = acquireLocation({ geo, budgetMs: 8000 });
    h.ok!(pos(500));
    h.ok!(pos(300));
    h.ok!(pos(900));
    await vi.advanceTimersByTimeAsync(8000);
    const r = await p;
    expect(r.fix?.accuracy).toBe(300);
  });
  it('does not wait when permission is denied', async () => {
    const { geo, h } = fakeGeo();
    const p = acquireLocation({ geo });
    h.err!(err(1));
    expect(await p).toEqual({ fix: null, reason: 'denied' });
  });
  it('gives up at the budget with no fix', async () => {
    vi.useFakeTimers();
    const { geo } = fakeGeo();
    const p = acquireLocation({ geo, budgetMs: 8000 });
    await vi.advanceTimersByTimeAsync(8000);
    expect(await p).toEqual({ fix: null, reason: 'timeout' });
  });
  it('reports unavailable after a position error', async () => {
    vi.useFakeTimers();
    const { geo, h } = fakeGeo();
    const p = acquireLocation({ geo, budgetMs: 8000 });
    h.err!(err(2));
    await vi.advanceTimersByTimeAsync(8000);
    expect((await p).reason).toBe('unavailable');
  });
  it('reports unavailable without geolocation', async () => {
    expect(await acquireLocation({ geo: null })).toEqual({ fix: null, reason: 'unavailable' });
  });
  it('returns the best fix so far when cancelled, or nothing', async () => {
    const a = fakeGeo();
    const c1 = new AbortController();
    const p1 = acquireLocation({ geo: a.geo, signal: c1.signal });
    a.h.ok!(pos(400));
    c1.abort();
    expect((await p1).fix?.accuracy).toBe(400);
    const b = fakeGeo();
    const c2 = new AbortController();
    const p2 = acquireLocation({ geo: b.geo, signal: c2.signal });
    c2.abort();
    expect(await p2).toEqual({ fix: null, reason: 'cancelled' });
    const c3 = new AbortController();
    c3.abort();
    expect((await acquireLocation({ geo: fakeGeo().geo, signal: c3.signal })).reason).toBe('cancelled');
  });
});

describe('translations', () => {
  it('has every key in every language', () => {
    for (const lang of ['hi', 'kn'] as const) {
      for (const k of Object.keys(SOS_TEXT.en) as (keyof typeof SOS_TEXT.en)[]) {
        expect(SOS_TEXT[lang][k].trim().length).toBeGreaterThan(0);
      }
      expect(SOS_TEXT[lang].locFound).toContain('{m}');
    }
  });
});
