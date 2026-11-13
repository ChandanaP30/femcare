// Backup file format, validation, encryption and restore planning for FemCare+.
// Pure logic: no app imports, no network. The database part lives in backup-service.ts.
//
// File format (version 1):
//   plain:     { format, version, app, createdAt, encrypted:false, counts, checksum:{alg,value}, data }
//   protected: { format, version, app, createdAt, encrypted:true, kdf, cipher, payload }
//              where payload is the plain envelope encrypted with AES-GCM (key from PBKDF2).
//
// The checksum detects damage (truncated or edited files). It is not a signature: only a
// protected (encrypted) backup is tamper-evident, because AES-GCM fails on any change.

export const BACKUP_FORMAT = 'femcare-backup';
export const BACKUP_VERSION = 1;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const PBKDF2_ITERATIONS = 600_000;
export const MIN_PASSPHRASE_LENGTH = 8;

const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 2_000_000;
const MAX_PERIODS = 10_000;
const MAX_LOGS = 100_000;
const MAX_NOTE = 20_000;
const AAD_TEXT = 'femcare-backup:v1';

export type Row = Record<string, unknown>;
type Rec = Record<string, unknown>;

export type FlowLevel = 'light' | 'medium' | 'heavy';
export type ThemeName = 'light' | 'dark' | 'system';
export type LanguageCode = 'en' | 'hi' | 'kn';

export interface BackupPeriod { start_date: string; end_date: string | null; notes: string; flow_level: FlowLevel | null }
export interface BackupDailyLog { log_date: string; mood: string; symptoms: string[]; pain_level: number | null; notes: string }
export interface BackupDayLog extends BackupDailyLog { period_start: string | null; flow_level: FlowLevel | null }
export interface BackupProfile {
  name: string;
  date_of_birth: string | null;
  cycle_length: number;
  period_duration: number;
  last_period_date: string | null;
  cycle_regularity: string;
  typical_symptoms: string[];
  onboarding_completed: boolean;
  preferences: Rec;
}
export interface BackupSettings { theme?: ThemeName; language?: LanguageCode; notifications?: Rec }
export interface BackupData {
  profile?: BackupProfile | null;
  settings?: BackupSettings | null;
  periods: BackupPeriod[];
  dailyLogs: BackupDailyLog[];
  periodDayLogs: BackupDayLog[];
  symptoms?: Rec[];
}
export interface BackupCounts { periods: number; dailyLogs: number; periodDayLogs: number; symptoms: number }

export type ParseErrorCode =
  | 'empty' | 'too_large' | 'not_json' | 'wrong_format' | 'unsupported_version' | 'newer_version'
  | 'needs_passphrase' | 'bad_passphrase' | 'unsupported_kdf' | 'corrupt' | 'checksum_mismatch'
  | 'invalid_data' | 'crypto_unavailable';

export type ParseResult =
  | { ok: true; data: BackupData; meta: { createdAt: string; encrypted: boolean; counts: BackupCounts; collapsed: number } }
  | { ok: false; code: ParseErrorCode; detail?: string[] };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const THEMES: ThemeName[] = ['light', 'dark', 'system'];
const LANGS: LanguageCode[] = ['en', 'hi', 'kn'];

function isRecord(v: unknown): v is Rec {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  if (y < 1900 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const isFlow = (v: unknown): v is FlowLevel | null => v === null || v === 'light' || v === 'medium' || v === 'heavy';
const isText = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
const isSymptomList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.length <= 200 && v.every((s) => typeof s === 'string' && s.length <= 200);
const isPain = (v: unknown): v is number | null =>
  v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10);

/** Same value for the same data, whatever the key order. Keys holding undefined are ignored, like JSON does. */
export function canonical(v: unknown): string {
  if (Array.isArray(v)) return '[' + v.map(canonical).join(',') + ']';
  if (isRecord(v)) {
    return '{' + Object.keys(v).filter((k) => v[k] !== undefined).sort()
      .map((k) => JSON.stringify(k) + ':' + canonical(v[k])).join(',') + '}';
  }
  return JSON.stringify(v) ?? 'null';
}

/** Copies a JSON value after checking it is plain, small and free of dangerous keys. Throws if not. */
function cleanJson(v: unknown, depth = 0): unknown {
  if (v === null || typeof v === 'boolean') return v;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error('number');
    return v;
  }
  if (typeof v === 'string') {
    if (v.length > 200_000) throw new Error('string');
    return v;
  }
  if (depth >= 8) throw new Error('depth');
  if (Array.isArray(v)) {
    if (v.length > 2000) throw new Error('array');
    return v.map((x) => cleanJson(x, depth + 1));
  }
  if (isRecord(v)) {
    const keys = Object.keys(v);
    if (keys.length > 200) throw new Error('keys');
    const out: Rec = {};
    for (const k of keys) {
      if (BAD_KEYS.has(k)) throw new Error('key');
      out[k] = cleanJson(v[k], depth + 1);
    }
    return out;
  }
  throw new Error('type');
}

function cleanObject(v: unknown): Rec {
  const out = cleanJson(v);
  if (!isRecord(out)) throw new Error('type');
  if (JSON.stringify(out).length > 400_000) throw new Error('size');
  return out;
}

function withoutCrypto(prefs: unknown): Rec {
  const out: Rec = {};
  if (isRecord(prefs)) for (const k of Object.keys(prefs)) if (k !== 'crypto' && !BAD_KEYS.has(k)) out[k] = prefs[k];
  return out;
}

function collapse<T>(items: T[]): { out: T[]; dropped: number } {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const k = canonical(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return { out, dropped: items.length - out.length };
}

export function countData(d: BackupData): BackupCounts {
  return { periods: d.periods.length, dailyLogs: d.dailyLogs.length, periodDayLogs: d.periodDayLogs.length, symptoms: d.symptoms?.length ?? 0 };
}

// ---------------------------------------------------------------------------
// Database rows -> backup shape (used for export, and to compare rows when restoring)
// ---------------------------------------------------------------------------

export function dateOnly(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, 10) : '';
}
const textOf = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const flowOf = (v: unknown): FlowLevel | null => (v === 'light' || v === 'medium' || v === 'heavy' ? v : null);
const painOf = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const listOf = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
const dateOrNull = (v: unknown): string | null => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null);

export function periodContent(r: Row): BackupPeriod {
  return { start_date: dateOnly(r.start_date), end_date: dateOrNull(r.end_date), notes: textOf(r.notes), flow_level: flowOf(r.flow_level) };
}
export function logContent(r: Row): BackupDailyLog {
  return { log_date: dateOnly(r.log_date), mood: textOf(r.mood), symptoms: listOf(r.symptoms), pain_level: painOf(r.pain_level), notes: textOf(r.notes) };
}
export function dayLogContent(r: Row, startByPeriodId: Map<string, string>): BackupDayLog {
  const pid = r.period_id == null ? '' : String(r.period_id);
  return { ...logContent(r), period_start: startByPeriodId.get(pid) ?? null, flow_level: flowOf(r.flow_level) };
}
const LEGACY_SKIP = new Set(['id', 'user_id', 'created_at', 'updated_at']);
const LEGACY_KEY = /^[a-z][a-z0-9_]{0,39}$/;
export function legacyContent(r: Row): Rec {
  const out: Rec = {};
  for (const k of Object.keys(r)) if (!LEGACY_SKIP.has(k) && LEGACY_KEY.test(k) && r[k] !== undefined) out[k] = r[k];
  return out;
}
export function profileContent(r: Row): BackupProfile {
  return {
    name: textOf(r.name),
    date_of_birth: dateOrNull(r.date_of_birth),
    cycle_length: typeof r.cycle_length === 'number' && Number.isFinite(r.cycle_length) ? r.cycle_length : 28,
    period_duration: typeof r.period_duration === 'number' && Number.isFinite(r.period_duration) ? r.period_duration : 5,
    last_period_date: dateOrNull(r.last_period_date),
    cycle_regularity: textOf(r.cycle_regularity),
    typical_symptoms: listOf(r.typical_symptoms),
    onboarding_completed: r.onboarding_completed === true,
    preferences: withoutCrypto(r.preferences),
  };
}
export function settingsContent(r: Row): BackupSettings {
  const out: BackupSettings = {};
  if (THEMES.includes(r.theme as ThemeName)) out.theme = r.theme as ThemeName;
  if (LANGS.includes(r.language as LanguageCode)) out.language = r.language as LanguageCode;
  if (isRecord(r.notifications)) out.notifications = r.notifications;
  return out;
}

export interface LocalData {
  profile: Row | null;
  settings: Row | null;
  periods: Row[];
  dailyLogs: Row[];
  periodDayLogs: Row[];
  /** null when the older symptoms table could not be read */
  symptoms: Row[] | null;
}

function startMap(periods: Row[]): Map<string, string> {
  return new Map(periods.map((p) => [String(p.id), dateOnly(p.start_date)]));
}

const byCanon = (a: unknown, b: unknown) => (canonical(a) < canonical(b) ? -1 : canonical(a) > canonical(b) ? 1 : 0);

/** Builds the data part of a backup from rows read for ONE user. Never includes ids, user ids, email or lock data. */
export function buildBackupData(local: LocalData): BackupData {
  const starts = startMap(local.periods);
  const data: BackupData = {
    profile: local.profile ? profileContent(local.profile) : null,
    settings: local.settings ? settingsContent(local.settings) : null,
    periods: local.periods.map(periodContent).sort(byCanon),
    dailyLogs: local.dailyLogs.map(logContent).sort(byCanon),
    periodDayLogs: local.periodDayLogs.map((r) => dayLogContent(r, starts)).sort(byCanon),
  };
  if (local.symptoms) data.symptoms = local.symptoms.map(legacyContent).sort(byCanon);
  return data;
}

// ---------------------------------------------------------------------------
// Validation (strict: one bad record rejects the whole file)
// ---------------------------------------------------------------------------

function readList<T>(raw: unknown, name: string, max: number, errs: string[], one: (r: Rec, p: string, e: string[]) => T): T[] {
  if (!Array.isArray(raw)) { errs.push(`${name}: must be a list`); return []; }
  if (raw.length > max) { errs.push(`${name}: too many entries`); return []; }
  const out: T[] = [];
  for (let i = 0; i < raw.length && errs.length < 8; i++) {
    const r = raw[i];
    if (!isRecord(r)) { errs.push(`${name}[${i}]: not an object`); continue; }
    const before = errs.length;
    const v = one(r, `${name}[${i}]`, errs);
    if (errs.length === before) out.push(v);
  }
  return out;
}

function need(ok: boolean, errs: string[], msg: string) { if (!ok) errs.push(msg); }

function readLogFields(r: Rec, p: string, e: string[]): BackupDailyLog {
  const mood = r.mood ?? '';
  const symptoms = r.symptoms ?? [];
  const pain = r.pain_level ?? null;
  const notes = r.notes ?? '';
  need(isDate(r.log_date), e, `${p}.log_date: not a valid date`);
  need(isText(mood, 100), e, `${p}.mood: must be short text`);
  need(isSymptomList(symptoms), e, `${p}.symptoms: must be a list of short text`);
  need(isPain(pain), e, `${p}.pain_level: must be 0 to 10`);
  need(isText(notes, MAX_NOTE), e, `${p}.notes: must be text`);
  return { log_date: r.log_date as string, mood: mood as string, symptoms: symptoms as string[], pain_level: pain as number | null, notes: notes as string };
}

function readProfile(raw: unknown, errs: string[]): BackupProfile | null {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw)) { errs.push('profile: not an object'); return null; }
  const dob = raw.date_of_birth ?? null;
  const last = raw.last_period_date ?? null;
  const symptoms = raw.typical_symptoms ?? [];
  const regularity = raw.cycle_regularity ?? '';
  need(isText(raw.name, 200), errs, 'profile.name: must be text');
  need(dob === null || isDate(dob), errs, 'profile.date_of_birth: not a valid date');
  need(last === null || isDate(last), errs, 'profile.last_period_date: not a valid date');
  need(Number.isInteger(raw.cycle_length) && (raw.cycle_length as number) >= 10 && (raw.cycle_length as number) <= 100, errs, 'profile.cycle_length: out of range');
  need(Number.isInteger(raw.period_duration) && (raw.period_duration as number) >= 1 && (raw.period_duration as number) <= 40, errs, 'profile.period_duration: out of range');
  need(isText(regularity, 40), errs, 'profile.cycle_regularity: must be short text');
  need(isSymptomList(symptoms), errs, 'profile.typical_symptoms: must be a list of short text');
  need(typeof raw.onboarding_completed === 'boolean', errs, 'profile.onboarding_completed: must be true or false');
  let preferences: Rec = {};
  try { preferences = withoutCrypto(cleanObject(raw.preferences ?? {})); } catch { errs.push('profile.preferences: not valid plain data'); }
  return {
    name: raw.name as string, date_of_birth: dob as string | null, cycle_length: raw.cycle_length as number,
    period_duration: raw.period_duration as number, last_period_date: last as string | null,
    cycle_regularity: regularity as string, typical_symptoms: symptoms as string[],
    onboarding_completed: raw.onboarding_completed as boolean, preferences,
  };
}

function readSettings(raw: unknown, errs: string[]): BackupSettings | null {
  if (raw === undefined || raw === null) return null;
  if (!isRecord(raw)) { errs.push('settings: not an object'); return null; }
  const out: BackupSettings = {};
  if (raw.theme !== undefined) { if (THEMES.includes(raw.theme as ThemeName)) out.theme = raw.theme as ThemeName; else errs.push('settings.theme: unknown value'); }
  if (raw.language !== undefined) { if (LANGS.includes(raw.language as LanguageCode)) out.language = raw.language as LanguageCode; else errs.push('settings.language: unknown value'); }
  if (raw.notifications !== undefined) {
    try { out.notifications = cleanObject(raw.notifications); } catch { errs.push('settings.notifications: not valid plain data'); }
  }
  return out;
}

export function validateData(raw: unknown): { ok: true; data: BackupData; collapsed: number } | { ok: false; errors: string[] } {
  const errs: string[] = [];
  if (!isRecord(raw)) return { ok: false, errors: ['data: not an object'] };
  let collapsed = 0;

  const periods = readList(raw.periods, 'periods', MAX_PERIODS, errs, (r, p, e): BackupPeriod => {
    const end = r.end_date ?? null;
    const notes = r.notes ?? '';
    const flow = r.flow_level ?? null;
    need(isDate(r.start_date), e, `${p}.start_date: not a valid date`);
    need(end === null || isDate(end), e, `${p}.end_date: not a valid date`);
    need(isText(notes, MAX_NOTE), e, `${p}.notes: must be text`);
    need(isFlow(flow), e, `${p}.flow_level: unknown value`);
    need(!(isDate(r.start_date) && typeof end === 'string' && isDate(end) && end < dateOnly(r.start_date)), e, `${p}.end_date: is before the start date`);
    return { start_date: r.start_date as string, end_date: end as string | null, notes: notes as string, flow_level: flow as FlowLevel | null };
  });
  const dailyLogs = readList(raw.dailyLogs, 'dailyLogs', MAX_LOGS, errs, readLogFields);
  const periodDayLogs = readList(raw.periodDayLogs, 'periodDayLogs', MAX_LOGS, errs, (r, p, e): BackupDayLog => {
    const base = readLogFields(r, p, e);
    const start = r.period_start ?? null;
    const flow = r.flow_level ?? null;
    need(start === null || isDate(start), e, `${p}.period_start: not a valid date`);
    need(isFlow(flow), e, `${p}.flow_level: unknown value`);
    return { ...base, period_start: start as string | null, flow_level: flow as FlowLevel | null };
  });

  let symptoms: Rec[] | undefined;
  if (raw.symptoms !== undefined && raw.symptoms !== null) {
    symptoms = readList(raw.symptoms, 'symptoms', MAX_LOGS, errs, (r, p, e): Rec => {
      const out: Rec = {};
      const keys = Object.keys(r);
      if (keys.length > 30) e.push(`${p}: too many fields`);
      for (const k of keys.slice(0, 30)) {
        if (LEGACY_SKIP.has(k)) continue;
        if (!LEGACY_KEY.test(k)) { e.push(`${p}: field name not allowed`); break; }
        try { out[k] = cleanJson(r[k], 4); } catch { e.push(`${p}.${k}: not valid plain data`); }
      }
      return out;
    });
  }

  const profile = readProfile(raw.profile, errs);
  const settings = readSettings(raw.settings, errs);
  if (errs.length > 0) return { ok: false, errors: errs.slice(0, 8) };

  const p2 = collapse(periods); const d2 = collapse(dailyLogs); const y2 = collapse(periodDayLogs);
  const s2 = symptoms ? collapse(symptoms) : null;
  collapsed = p2.dropped + d2.dropped + y2.dropped + (s2?.dropped ?? 0);
  const data: BackupData = { profile, settings, periods: p2.out, dailyLogs: d2.out, periodDayLogs: y2.out };
  if (s2) data.symptoms = s2.out;
  return { ok: true, data, collapsed };
}

// ---------------------------------------------------------------------------
// Encoding, checksum and encryption (Web Crypto only, no extra packages)
// ---------------------------------------------------------------------------

const enc = new TextEncoder();

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(s: string) {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('b64');
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function cryptoReady(): boolean {
  return typeof crypto !== 'undefined' && !!crypto.subtle && typeof crypto.getRandomValues === 'function';
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function deriveAesKey(passphrase: string, salt: BufferSource, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Turns backup data into the text of a backup file. Pass a passphrase to protect (encrypt) it. */
export async function serializeBackup(data: BackupData, opts: { passphrase?: string; now?: Date } = {}): Promise<string> {
  if (!cryptoReady()) throw new Error('crypto_unavailable');
  const createdAt = (opts.now ?? new Date()).toISOString();
  const envelope = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: 'FemCare+',
    createdAt,
    encrypted: false,
    counts: countData(data),
    checksum: { alg: 'sha256', value: await sha256Hex(canonical(data)) },
    data,
  };
  if (!opts.passphrase) return JSON.stringify(envelope, null, 2);
  if (opts.passphrase.length < MIN_PASSPHRASE_LENGTH) throw new Error('passphrase_too_short');

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(opts.passphrase, salt, PBKDF2_ITERATIONS);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(AAD_TEXT) }, key, enc.encode(JSON.stringify(envelope)));
  return JSON.stringify({
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    app: 'FemCare+',
    createdAt,
    encrypted: true,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: toB64(salt) },
    cipher: { name: 'AES-GCM', iv: toB64(iv) },
    payload: toB64(new Uint8Array(cipher)),
  }, null, 2);
}

async function decryptOuter(outer: Rec, passphrase: string): Promise<{ ok: true; text: string } | { ok: false; code: ParseErrorCode }> {
  const kdf = outer.kdf;
  const cipher = outer.cipher;
  if (!isRecord(kdf) || !isRecord(cipher) || typeof outer.payload !== 'string') return { ok: false, code: 'corrupt' };
  if (kdf.name !== 'PBKDF2' || kdf.hash !== 'SHA-256' || cipher.name !== 'AES-GCM') return { ok: false, code: 'unsupported_kdf' };
  const iterations = kdf.iterations;
  if (typeof iterations !== 'number' || !Number.isInteger(iterations) || iterations < MIN_ITERATIONS || iterations > MAX_ITERATIONS) {
    return { ok: false, code: 'unsupported_kdf' };
  }
  if (typeof kdf.salt !== 'string' || typeof cipher.iv !== 'string') return { ok: false, code: 'corrupt' };
  let salt: Uint8Array; let iv: Uint8Array; let payload: Uint8Array;
  try {
    salt = fromB64(kdf.salt); iv = fromB64(cipher.iv); payload = fromB64(outer.payload);
  } catch { return { ok: false, code: 'corrupt' }; }
  if (salt.length < 8 || salt.length > 64 || iv.length !== 12 || payload.length < 16) return { ok: false, code: 'corrupt' };
  try {
    const key = await deriveAesKey(passphrase, salt, iterations);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(AAD_TEXT) }, key, payload);
    return { ok: true, text: new TextDecoder('utf-8', { fatal: true }).decode(plain) };
  } catch {
    // AES-GCM cannot tell a wrong passphrase from a changed file.
    return { ok: false, code: 'bad_passphrase' };
  }
}

/** Reads and checks a backup file. Never throws. Writes nothing. */
export async function parseBackup(text: string, passphrase?: string): Promise<ParseResult> {
  const fail = (code: ParseErrorCode, detail?: string[]): ParseResult => ({ ok: false, code, detail });
  if (typeof text !== 'string' || text.trim() === '') return fail('empty');
  if (text.length > MAX_FILE_BYTES) return fail('too_large');
  if (!cryptoReady()) return fail('crypto_unavailable');

  let outer: unknown;
  try { outer = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text); } catch { return fail('not_json'); }
  if (!isRecord(outer) || outer.format !== BACKUP_FORMAT) return fail('wrong_format');
  const version = outer.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return fail('unsupported_version');
  if (version > BACKUP_VERSION) return fail('newer_version');

  let env: Rec = outer;
  let encrypted = false;
  if (outer.encrypted === true) {
    encrypted = true;
    if (!passphrase) return fail('needs_passphrase');
    const dec = await decryptOuter(outer, passphrase);
    if (!dec.ok) return fail(dec.code);
    let inner: unknown;
    try { inner = JSON.parse(dec.text); } catch { return fail('corrupt'); }
    if (!isRecord(inner) || inner.format !== BACKUP_FORMAT || inner.version !== version || inner.encrypted !== false) return fail('corrupt');
    env = inner;
  } else if (outer.encrypted !== false) {
    return fail('wrong_format');
  }

  const cs = env.checksum;
  if (!isRecord(cs) || cs.alg !== 'sha256' || typeof cs.value !== 'string') return fail('checksum_mismatch');
  if (!isRecord(env.data)) return fail('invalid_data', ['data: missing']);
  if ((await sha256Hex(canonical(env.data))) !== cs.value.toLowerCase()) return fail('checksum_mismatch');

  const checked = validateData(env.data);
  if (!checked.ok) return fail('invalid_data', checked.errors);
  const created = typeof env.createdAt === 'string' && !Number.isNaN(Date.parse(env.createdAt)) ? env.createdAt : '';
  return { ok: true, data: checked.data, meta: { createdAt: created, encrypted, counts: countData(checked.data), collapsed: checked.collapsed } };
}

// ---------------------------------------------------------------------------
// Restore planning (pure: compares the file with what is on this device)
// ---------------------------------------------------------------------------

export type RestoreMode = 'merge' | 'replace';
export type TableKey = 'periods' | 'dailyLogs' | 'periodDayLogs' | 'symptoms';
export const TABLE_KEYS: TableKey[] = ['periods', 'dailyLogs', 'periodDayLogs', 'symptoms'];
export const TABLE_NAME: Record<TableKey, string> = {
  periods: 'periods',
  dailyLogs: 'daily_logs',
  periodDayLogs: 'period_day_logs',
  symptoms: 'symptoms',
};

export interface TablePlan {
  insert: Row[];
  update: { id: string; row: Row }[];
  remove: string[];
  unchanged: number;
  skipped: number;
}
export interface ProfilePlan { patch: Row; before: Row }
export interface RestorePlan {
  mode: RestoreMode;
  tables: Record<TableKey, TablePlan | null>;
  profile: ProfilePlan | null;
  settings: ProfilePlan | null;
}

interface Item { key: string; content: Row }
interface LocalItem extends Item { id: string }

function groupBy<T extends Item>(items: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const it of items) { const g = m.get(it.key); if (g) g.push(it); else m.set(it.key, [it]); }
  return m;
}

/**
 * Identity of a record: periods by start date, logs by date, older symptom rows by their whole content.
 * Merge adds a record only when nothing with the same identity exists here (the existing one always wins).
 * Replace makes this device match the file: update what differs, add what is missing, remove what is not in the file.
 */
export function planTable(local: LocalItem[], incoming: Item[], mode: RestoreMode): TablePlan {
  const have = groupBy(local);
  const want = groupBy(incoming);
  const plan: TablePlan = { insert: [], update: [], remove: [], unchanged: 0, skipped: 0 };
  for (const [key, items] of want) {
    const mine = have.get(key) ?? [];
    if (mode === 'merge') {
      if (mine.length > 0) plan.skipped += items.length; else plan.insert.push(...items.map((i) => i.content));
      continue;
    }
    items.forEach((it, i) => {
      const m = mine[i];
      if (!m) plan.insert.push(it.content);
      else if (canonical(m.content) === canonical(it.content)) plan.unchanged += 1;
      else plan.update.push({ id: m.id, row: it.content });
    });
    for (let i = items.length; i < mine.length; i++) plan.remove.push(mine[i].id);
  }
  if (mode === 'replace') for (const [key, mine] of have) if (!want.has(key)) mine.forEach((m) => plan.remove.push(m.id));
  return plan;
}

const pick = (row: Row, keys: string[]): Row => Object.fromEntries(keys.map((k) => [k, row[k]]));

function planProfile(file: BackupProfile | null | undefined, local: Row | null, mode: RestoreMode): ProfilePlan | null {
  if (!file || !local) return null; // a missing profile row is never created by a restore
  const mine = profileContent(local);
  const patch: Row = {};
  if (mode === 'replace') {
    const cols = ['name', 'date_of_birth', 'cycle_length', 'period_duration', 'last_period_date', 'cycle_regularity', 'typical_symptoms', 'onboarding_completed'] as const;
    for (const c of cols) if (canonical(file[c]) !== canonical(mine[c])) patch[c] = file[c];
    if (canonical(file.preferences) !== canonical(mine.preferences)) {
      const lock = isRecord(local.preferences) ? local.preferences.crypto : undefined; // never replaced: it holds this device's lock
      patch.preferences = lock === undefined ? { ...file.preferences } : { ...file.preferences, crypto: lock };
    }
  } else {
    if (!mine.name && file.name) patch.name = file.name;
    if (mine.date_of_birth === null && file.date_of_birth) patch.date_of_birth = file.date_of_birth;
    if (mine.last_period_date === null && file.last_period_date) patch.last_period_date = file.last_period_date;
    if (mine.typical_symptoms.length === 0 && file.typical_symptoms.length > 0) patch.typical_symptoms = file.typical_symptoms;
    const localPrefs = isRecord(local.preferences) ? local.preferences : {};
    const extra = Object.keys(file.preferences).filter((k) => !(k in localPrefs));
    if (extra.length > 0) patch.preferences = { ...localPrefs, ...pick(file.preferences, extra) };
  }
  const keys = Object.keys(patch);
  return keys.length === 0 ? null : { patch, before: pick(local, keys) };
}

function planSettings(file: BackupSettings | null | undefined, local: Row | null, mode: RestoreMode): ProfilePlan | null {
  if (!file || !local) return null;
  const patch: Row = {};
  if (mode === 'replace') {
    for (const c of ['theme', 'language', 'notifications'] as const) {
      if (file[c] !== undefined && canonical(file[c]) !== canonical(local[c])) patch[c] = file[c];
    }
  } else if (file.notifications && (!isRecord(local.notifications) || Object.keys(local.notifications).length === 0)) {
    patch.notifications = file.notifications;
  }
  const keys = Object.keys(patch);
  return keys.length === 0 ? null : { patch, before: pick(local, keys) };
}

export function planRestore(file: BackupData, local: LocalData, mode: RestoreMode): RestorePlan {
  const starts = startMap(local.periods);
  const tables: Record<TableKey, TablePlan | null> = {
    periods: planTable(
      local.periods.map((r) => ({ id: String(r.id), key: dateOnly(r.start_date), content: periodContent(r) as unknown as Row })),
      file.periods.map((c) => ({ key: c.start_date, content: c as unknown as Row })), mode),
    dailyLogs: planTable(
      local.dailyLogs.map((r) => ({ id: String(r.id), key: dateOnly(r.log_date), content: logContent(r) as unknown as Row })),
      file.dailyLogs.map((c) => ({ key: c.log_date, content: c as unknown as Row })), mode),
    periodDayLogs: planTable(
      local.periodDayLogs.map((r) => ({ id: String(r.id), key: dateOnly(r.log_date), content: dayLogContent(r, starts) as unknown as Row })),
      file.periodDayLogs.map((c) => ({ key: c.log_date, content: c as unknown as Row })), mode),
    // older symptoms table: only touched when the file has that section and this device could read it
    symptoms: file.symptoms && local.symptoms
      ? planTable(
        local.symptoms.map((r) => { const c = legacyContent(r); return { id: String(r.id), key: canonical(c), content: c }; }),
        file.symptoms.map((c) => ({ key: canonical(c), content: c })), mode)
      : null,
  };
  return { mode, tables, profile: planProfile(file.profile, local.profile, mode), settings: planSettings(file.settings, local.settings, mode) };
}

export interface PlanSummary {
  mode: RestoreMode;
  tables: Record<TableKey, { insert: number; update: number; remove: number; skipped: number; unchanged: number } | null>;
  total: { insert: number; update: number; remove: number; skipped: number; unchanged: number };
  profileChange: boolean;
  settingsChange: boolean;
}

export function summarizePlan(plan: RestorePlan): PlanSummary {
  const total = { insert: 0, update: 0, remove: 0, skipped: 0, unchanged: 0 };
  const tables = {} as PlanSummary['tables'];
  for (const k of TABLE_KEYS) {
    const t = plan.tables[k];
    if (!t) { tables[k] = null; continue; }
    const s = { insert: t.insert.length, update: t.update.length, remove: t.remove.length, skipped: t.skipped, unchanged: t.unchanged };
    tables[k] = s;
    total.insert += s.insert; total.update += s.update; total.remove += s.remove; total.skipped += s.skipped; total.unchanged += s.unchanged;
  }
  return { mode: plan.mode, tables, total, profileChange: plan.profile !== null, settingsChange: plan.settings !== null };
}
