/** Pure helpers for the standalone SOS panel. No network, no Supabase, no React. */

export const SOS_OPEN_EVENT = 'femcare:sos-open';
/** Same key prefix as the offline mirror in offline.ts. The panel only reads it. */
export const MIRROR_PREFIX = 'femcare_offline_v1:';

export interface SosContact { id: string; name: string; phone: string }
export interface Fix { lat: number; lon: number; accuracy: number | null }
export type LocationReason = 'ok' | 'denied' | 'unavailable' | 'timeout' | 'cancelled';
export interface LocationResult { fix: Fix | null; reason: LocationReason }

export function isSosLink(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'com.femcare.app:' && u.hostname === 'sos';
  } catch {
    return false;
  }
}

export function cleanPhone(raw: string): string {
  const s = String(raw ?? '').trim();
  return (s.startsWith('+') ? '+' : '') + s.replace(/\D/g, '');
}

export function maskPhone(raw: string): string {
  const digits = cleanPhone(raw).replace(/\D/g, '');
  return digits.length <= 4 ? '••••' : `•••• ${digits.slice(-4)}`;
}

export function normalizeContacts(rows: unknown): SosContact[] {
  if (!Array.isArray(rows)) return [];
  const out: (SosContact & { at: string })[] = [];
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const phone = typeof o.phone === 'string' ? cleanPhone(o.phone) : '';
    if (phone.replace(/\D/g, '').length < 3) continue;
    const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim() : phone;
    out.push({ id: String(o.id ?? phone), name, phone, at: typeof o.created_at === 'string' ? o.created_at : '' });
  }
  out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return out.map(({ id, name, phone }) => ({ id, name, phone }));
}

/** Contacts from the offline mirror. null means they were never downloaded to this device. */
export function readMirrorContacts(userId: string, storage?: Pick<Storage, 'getItem'>): SosContact[] | null {
  try {
    const s = storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined);
    const raw = s?.getItem(MIRROR_PREFIX + userId);
    if (!raw) return null;
    const rows = (JSON.parse(raw) as { rows?: Record<string, unknown> })?.rows?.emergency_contacts;
    return rows === undefined ? null : normalizeContacts(rows);
  } catch {
    return null;
  }
}

export function mapsLink(lat: number, lon: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lon.toFixed(6)}`;
}

export function buildMessage(fix: Fix | null, now: Date = new Date()): string {
  if (!fix) return 'SOS! I need help but I could not get my location. Please call me now.';
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const acc = fix.accuracy !== null ? `, accuracy about ${Math.round(fix.accuracy)} m` : '';
  return `SOS! I need help. My location: ${mapsLink(fix.lat, fix.lon)} (${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}${acc}, ${hh}:${mm}). Please call me or send help.`;
}

export function smsUri(phone: string, body: string): string {
  return `sms:${cleanPhone(phone)}?body=${encodeURIComponent(body)}`;
}

type GeoLike = Pick<Geolocation, 'getCurrentPosition' | 'watchPosition' | 'clearWatch'>;

/**
 * One location fix within a fixed time budget. Uses a fix at once when it is accurate enough,
 * otherwise the best fix seen when the budget ends. Permission denied returns immediately.
 */
export function acquireLocation(opts: {
  budgetMs?: number;
  goodAccuracyM?: number;
  signal?: AbortSignal;
  geo?: GeoLike | null;
} = {}): Promise<LocationResult> {
  const budget = opts.budgetMs ?? 8000;
  const good = opts.goodAccuracyM ?? 150;
  const geo: GeoLike | undefined =
    opts.geo === null ? undefined : (opts.geo ?? (typeof navigator !== 'undefined' ? navigator.geolocation : undefined));

  return new Promise((resolve) => {
    if (!geo) {
      resolve({ fix: null, reason: 'unavailable' });
      return;
    }
    let best: Fix | null = null;
    let done = false;
    let watchId: number | null = null;
    let lastReason: LocationReason = 'timeout';

    const timer = setTimeout(() => finish(lastReason), budget);
    const onAbort = () => finish('cancelled');
    function finish(reason: LocationReason) {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (watchId !== null) geo!.clearWatch(watchId);
      opts.signal?.removeEventListener('abort', onAbort);
      resolve({ fix: best, reason: best ? 'ok' : reason });
    }
    const consider = (p: GeolocationPosition) => {
      const acc = Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : null;
      const f: Fix = { lat: p.coords.latitude, lon: p.coords.longitude, accuracy: acc };
      if (!best || (f.accuracy ?? Infinity) < (best.accuracy ?? Infinity)) best = f;
      if ((f.accuracy ?? Infinity) <= good) finish('ok');
    };
    const onError = (e: GeolocationPositionError) => {
      if (e.code === 1) finish('denied');
      else lastReason = e.code === 2 ? 'unavailable' : 'timeout';
    };

    if (opts.signal) {
      if (opts.signal.aborted) {
        finish('cancelled');
        return;
      }
      opts.signal.addEventListener('abort', onAbort);
    }
    geo.getCurrentPosition(consider, onError, { enableHighAccuracy: false, maximumAge: 10 * 60 * 1000, timeout: budget });
    watchId = geo.watchPosition(consider, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: budget });
    if (done) geo.clearWatch(watchId);
  });
}
