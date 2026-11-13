// @vitest-environment node
// Runs against an in-memory fake that imitates the database calls. It is NOT a real Supabase.
import { describe, it, expect } from 'vitest';
import { buildBackupData, serializeBackup, parseBackup, type BackupData, type Row } from './backup-core';
import { createBackup, makeSupabaseDb, prepareRestore, runRestore, type BackupDb, type BackupDeps, type Connectivity } from './backup-service';

class FakeDb implements BackupDb {
  tables: Record<string, Row[]> = { periods: [], daily_logs: [], period_day_logs: [], symptoms: [] };
  profile: Row | null = { id: 'u1', name: 'Asha', cycle_length: 28, period_duration: 5, last_period_date: null, preferences: { crypto: { salt: 'SECRET' }, a: 1 }, email: 'a@b.c' };
  settings: Row | null = { user_id: 'u1', theme: 'light', language: 'en', notifications: {} };
  n = 0;
  failInsertAt = -1; inserts = 0; failDelete = false;
  async readProfile() { return this.profile ? { ...this.profile } : null; }
  async readSettings() { return this.settings ? { ...this.settings } : null; }
  async readAll(t: string) { return this.tables[t].map((r) => ({ ...r })); }
  async insertRows(t: string, rows: Row[]) {
    if (this.inserts++ === this.failInsertAt) throw new Error('boom');
    const out: Row[] = [];
    for (const r of rows) {
      if ((t === 'daily_logs' || t === 'period_day_logs') && this.tables[t].some((x) => x.log_date === r.log_date && x.user_id === r.user_id)) throw new Error('unique violation');
      const row = { ...r, id: 'id' + ++this.n }; this.tables[t].push(row); out.push({ ...row });
    }
    return out;
  }
  async upsertRows(t: string, rows: Row[]) { for (const r of rows) { const i = this.tables[t].findIndex((x) => x.id === r.id); if (i >= 0) this.tables[t][i] = { ...this.tables[t][i], ...r }; else this.tables[t].push({ ...r }); } }
  async deleteRows(t: string, ids: string[]) { if (this.failDelete) throw new Error('nodelete'); this.tables[t] = this.tables[t].filter((r) => !ids.includes(String(r.id))); }
  async saveProfile(p: Row) { this.profile = { ...this.profile, ...p }; }
  async saveSettings(p: Row) { this.settings = { ...this.settings, ...p }; }
  add(t: string, r: Row) { this.tables[t].push({ id: 'id' + ++this.n, user_id: 'u1', ...r }); }
}
const mk = (db: FakeDb, c: Connectivity = 'ok'): BackupDeps => ({ db, userId: 'u1', connectivity: () => c });
const seed = (db: FakeDb) => {
  db.add('periods', { start_date: '2026-01-01', end_date: '2026-01-05', notes: 'n1', flow_level: 'medium' });
  db.add('periods', { start_date: '2026-02-01', end_date: '2026-02-05', notes: '', flow_level: 'heavy' });
  db.add('daily_logs', { log_date: '2026-01-02', mood: 'happy', symptoms: ['cramps'], pain_level: 3, notes: 'x' });
  db.add('period_day_logs', { period_id: db.tables.periods[0].id, log_date: '2026-01-02', mood: 'ok', symptoms: [], pain_level: 1, notes: '', flow_level: 'light' });
};
const exportPlain = async (db: FakeDb) => { const r = await createBackup(mk(db)); if (!r.ok) throw new Error(r.code); return r; };
const count = (db: FakeDb) => Object.fromEntries(Object.entries(db.tables).map(([k, v]) => [k, v.length]));

describe('export', () => {
  it('contains the data and leaves out secrets', async () => {
    const db = new FakeDb(); seed(db);
    const r = await exportPlain(db);
    expect(r.counts).toMatchObject({ periods: 2, dailyLogs: 1, periodDayLogs: 1 });
    expect(r.filename).toMatch(/^femcare-backup-\d{4}-\d\d-\d\d\.json$/);
    expect(r.text).not.toContain('SECRET');
    expect(r.text).not.toContain('a@b.c');
    expect(r.text).not.toContain('user_id');
    const p = await parseBackup(r.text);
    expect(p.ok).toBe(true);
  });
  it('protected export is encrypted, needs the right passphrase, and is tamper evident', async () => {
    const db = new FakeDb(); seed(db);
    const r = await createBackup(mk(db), { passphrase: 'correct horse' });
    if (!r.ok) throw new Error(r.code);
    expect(r.filename).toContain('-protected');
    expect(r.text).not.toContain('2026-01-01');
    expect(r.text).not.toContain('cramps');
    const none = await parseBackup(r.text); expect(none).toMatchObject({ ok: false, code: 'needs_passphrase' });
    const bad = await parseBackup(r.text, 'wrong pass!'); expect(bad).toMatchObject({ ok: false, code: 'bad_passphrase' });
    const good = await parseBackup(r.text, 'correct horse'); expect(good.ok).toBe(true);
    const obj = JSON.parse(r.text); const b = obj.payload; obj.payload = (b[0] === 'A' ? 'B' : 'A') + b.slice(1);
    const t = await parseBackup(JSON.stringify(obj), 'correct horse'); expect(t.ok).toBe(false);
  });
  it('refuses while offline or syncing', async () => {
    const db = new FakeDb();
    expect(await createBackup(mk(db, 'offline'))).toMatchObject({ ok: false, code: 'offline' });
    expect(await createBackup(mk(db, 'pending_sync'))).toMatchObject({ ok: false, code: 'pending_sync' });
  });
  it('real Supabase adapter reads past the 1000-row server cap and scopes every write to the user', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: String(i).padStart(5, '0'), user_id: 'u1' }));
    const calls: string[] = [];
    const client = { from: (table: string) => {
      const f: Record<string, unknown> = {}; let lo = 0, hi = 0, op = 'select';
      const q: Record<string, unknown> = {
        select: () => q, order: () => q, eq: (c: string, v: unknown) => { f[c] = v; return q; }, in: (c: string, v: unknown) => { f[c] = v; return q; },
        range: (a: number, b: number) => { lo = a; hi = Math.min(b, a + 999); return q; }, // server caps a page at 1000 rows
        delete: () => { op = 'delete'; return q; },
        then: (res: (v: unknown) => void) => { if (op === 'delete') { calls.push(table + ':' + JSON.stringify(f)); res({ error: null }); } else res({ data: rows.slice(lo, hi + 1), error: null }); },
      };
      return q;
    } };
    const db = makeSupabaseDb(client as never, 'u1');
    expect((await db.readAll('daily_logs')).length).toBe(2500);
    await db.deleteRows('daily_logs', ['a', 'b']);
    expect(calls[0]).toBe('daily_logs:{"user_id":"u1","id":["a","b"]}');
  });
});

describe('invalid files are rejected', () => {
  const cases: [string, string, string][] = [
    ['empty', '', 'empty'], ['whitespace', '   ', 'empty'], ['not json', 'hello', 'not_json'], ['truncated', '{"format":"femcare-backup","vers', 'not_json'],
    ['wrong format', '{"a":1}', 'wrong_format'], ['array', '[]', 'wrong_format'],
    ['future version', JSON.stringify({ format: 'femcare-backup', version: 99 }), 'newer_version'],
    ['old version', JSON.stringify({ format: 'femcare-backup', version: 0 }), 'unsupported_version'],
  ];
  for (const [name, text, code] of cases) it(name, async () => { expect(await parseBackup(text)).toMatchObject({ ok: false, code }); });
  it('too large', async () => { expect(await parseBackup('x'.repeat(21 * 1024 * 1024))).toMatchObject({ ok: false, code: 'too_large' }); });
  it('edited data fails the checksum', async () => {
    const db = new FakeDb(); seed(db); const r = await exportPlain(db);
    expect(await parseBackup(r.text.replace('2026-01-01', '2026-01-09'))).toMatchObject({ ok: false, code: 'checksum_mismatch' });
  });
  it('invalid records are rejected even with a valid checksum', async () => {
    const mkFile = async (patch: (d: BackupData) => void) => { const d = buildBackupData({ profile: null, settings: null, periods: [], dailyLogs: [], periodDayLogs: [], symptoms: null }); patch(d); return serializeBackup(d); };
    expect(await parseBackup(await mkFile((d) => d.periods.push({ start_date: 'nope', end_date: null, notes: '', flow_level: null })))).toMatchObject({ ok: false, code: 'invalid_data' });
    expect(await parseBackup(await mkFile((d) => d.periods.push({ start_date: '2026-03-10', end_date: '2026-03-01', notes: '', flow_level: null })))).toMatchObject({ ok: false, code: 'invalid_data' });
    expect(await parseBackup(await mkFile((d) => d.dailyLogs.push({ log_date: '2026-03-01', mood: '', symptoms: [], pain_level: 99, notes: '' })))).toMatchObject({ ok: false, code: 'invalid_data' });
  });
  it('a __proto__ key injected into the file is rejected and nothing is polluted', async () => {
    const d = buildBackupData({ profile: null, settings: null, periods: [], dailyLogs: [], periodDayLogs: [], symptoms: null });
    const text = await serializeBackup(d);
    expect(text).toContain('"data": {');
    const evil = text.replace('"data": {', '"data": {"__proto__":{"polluted":true},');
    const r = await parseBackup(evil); expect(r.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('a __proto__ key inside profile preferences is rejected even with a valid checksum', async () => {
    const d = buildBackupData({ profile: { name: 'A', cycle_length: 28, period_duration: 5, preferences: {} }, settings: null, periods: [], dailyLogs: [], periodDayLogs: [], symptoms: null });
    d.profile!.preferences = JSON.parse('{"__proto__":{"polluted":true}}');
    const r = await parseBackup(await serializeBackup(d)); expect(r.ok).toBe(false);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('restore', () => {
  it('merge into an empty account adds everything, re-links day logs, forces user_id', async () => {
    const src = new FakeDb(); seed(src); const f = (await parseBackup((await exportPlain(src)).text)); if (!f.ok) throw 0;
    const dst = new FakeDb(); const r = await runRestore(mk(dst), f.data, 'merge'); expect(r.ok).toBe(true);
    expect(count(dst)).toMatchObject({ periods: 2, daily_logs: 1, period_day_logs: 1 });
    expect(dst.tables.periods.every((p) => p.user_id === 'u1')).toBe(true);
    const link = dst.tables.period_day_logs[0].period_id; expect(dst.tables.periods.find((p) => p.id === link)?.start_date).toBe('2026-01-01');
  });
  it('restoring the same file twice creates no duplicates', async () => {
    const src = new FakeDb(); seed(src); const f = await parseBackup((await exportPlain(src)).text); if (!f.ok) throw 0;
    const dst = new FakeDb(); await runRestore(mk(dst), f.data, 'merge'); const before = JSON.stringify(count(dst));
    const r = await runRestore(mk(dst), f.data, 'merge'); expect(r.ok && r.total.inserted).toBe(0);
    expect(JSON.stringify(count(dst))).toBe(before);
    await runRestore(mk(dst), f.data, 'replace'); expect(JSON.stringify(count(dst))).toBe(before);
  });
  it('merge keeps existing records for the same date and keeps extra local records', async () => {
    const src = new FakeDb(); seed(src); const f = await parseBackup((await exportPlain(src)).text); if (!f.ok) throw 0;
    const dst = new FakeDb(); dst.add('periods', { start_date: '2026-01-01', end_date: '2026-01-03', notes: 'LOCAL', flow_level: 'light' }); dst.add('periods', { start_date: '2025-05-05', end_date: null, notes: '', flow_level: null });
    await runRestore(mk(dst), f.data, 'merge');
    expect(dst.tables.periods.length).toBe(3);
    expect(dst.tables.periods.find((p) => p.start_date === '2026-01-01')?.notes).toBe('LOCAL');
    expect(dst.tables.periods.some((p) => p.start_date === '2025-05-05')).toBe(true);
  });
  it('replace makes the device match the file and removes extras', async () => {
    const src = new FakeDb(); seed(src); const f = await parseBackup((await exportPlain(src)).text); if (!f.ok) throw 0;
    const dst = new FakeDb(); dst.add('periods', { start_date: '2026-01-01', end_date: '2026-01-03', notes: 'LOCAL', flow_level: 'light' }); dst.add('periods', { start_date: '2025-05-05', end_date: null, notes: '', flow_level: null });
    dst.add('daily_logs', { log_date: '2026-01-02', mood: 'sad', symptoms: [], pain_level: 9, notes: 'old' }); dst.add('daily_logs', { log_date: '2024-01-01', mood: '', symptoms: [], pain_level: null, notes: '' });
    const r = await runRestore(mk(dst), f.data, 'replace'); expect(r.ok).toBe(true);
    expect(dst.tables.periods.map((p) => p.start_date).sort()).toEqual(['2026-01-01', '2026-02-01']);
    expect(dst.tables.periods.find((p) => p.start_date === '2026-01-01')?.notes).toBe('n1');
    expect(dst.tables.daily_logs.length).toBe(1); expect(dst.tables.daily_logs[0].mood).toBe('happy');
  });
  it('never restores the app-lock crypto, email or ids; merge only fills empty profile fields', async () => {
    const src = new FakeDb(); seed(src); src.profile = { ...src.profile, name: 'FromBackup', cycle_length: 31 }; const f = await parseBackup((await exportPlain(src)).text); if (!f.ok) throw 0;
    const dst = new FakeDb(); dst.profile = { id: 'u1', name: 'Mine', cycle_length: 28, period_duration: 5, last_period_date: null, preferences: { crypto: { salt: 'MINE' } } };
    await runRestore(mk(dst), f.data, 'merge'); expect(dst.profile?.name).toBe('Mine');
    expect((dst.profile?.preferences as Row).crypto).toEqual({ salt: 'MINE' });
    await runRestore(mk(dst), f.data, 'replace'); expect(dst.profile?.name).toBe('FromBackup');
    expect((dst.profile?.preferences as Row).crypto).toEqual({ salt: 'MINE' });
    expect(dst.profile?.email).toBeUndefined();
  });
  it('rolls back everything if a write fails halfway', async () => {
    const src = new FakeDb(); seed(src); const f = await parseBackup((await exportPlain(src)).text); if (!f.ok) throw 0;
    const dst = new FakeDb(); dst.add('periods', { start_date: '2025-05-05', end_date: null, notes: '', flow_level: null });
    const snap = JSON.stringify(dst.tables); dst.failInsertAt = 2;
    const r = await runRestore(mk(dst), f.data, 'merge');
    expect(r).toMatchObject({ ok: false, code: 'failed', rolledBack: true });
    expect(JSON.stringify(dst.tables)).toBe(snap);
  });
  it('refuses to restore when offline or while changes are syncing', async () => {
    const f = await parseBackup((await exportPlain(new FakeDb())).text); if (!f.ok) throw 0;
    expect(await runRestore(mk(new FakeDb(), 'offline'), f.data, 'merge')).toMatchObject({ ok: false, code: 'offline' });
    expect(await runRestore(mk(new FakeDb(), 'pending_sync'), f.data, 'replace')).toMatchObject({ ok: false, code: 'pending_sync' });
  });
  it('preview writes nothing and reports merge vs replace', async () => {
    const src = new FakeDb(); seed(src); const f = await parseBackup((await exportPlain(src)).text); if (!f.ok) throw 0;
    const dst = new FakeDb(); dst.add('periods', { start_date: '2025-05-05', end_date: null, notes: '', flow_level: null });
    const snap = JSON.stringify(dst.tables); const p = await prepareRestore(mk(dst), f.data);
    if (!p.ok) throw 0; expect(p.merge.total.insert).toBeGreaterThan(0); expect(p.replace.total.remove).toBe(1); expect(p.merge.total.remove).toBe(0);
    expect(JSON.stringify(dst.tables)).toBe(snap);
  });
  it('reports a failed removal without losing the added data', async () => {
    const src = new FakeDb(); seed(src); const f = await parseBackup((await exportPlain(src)).text); if (!f.ok) throw 0;
    const dst = new FakeDb(); dst.add('periods', { start_date: '2025-05-05', end_date: null, notes: '', flow_level: null }); dst.failDelete = true;
    const r = await runRestore(mk(dst), f.data, 'replace'); expect(r.ok && r.removalFailed).toBe(true);
    expect(dst.tables.periods.length).toBe(3);
  });
});
