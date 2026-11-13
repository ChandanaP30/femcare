// Reads and writes the signed-in user's own rows for backup and restore.
// All database access goes through BackupDb, so the logic can be tested without a server.
//
// A restore is not one database transaction (the Supabase client has none), so it works like this:
//   1. add new rows and update changed rows, remembering exactly what was done
//   2. if any step fails, undo it (delete what was added, put the old values back)
//   3. only after everything succeeded, remove old rows (replace mode only)
// Old data is therefore never removed before the new data is safely in place.

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  TABLE_KEYS, TABLE_NAME, buildBackupData, dateOnly, planRestore, serializeBackup, summarizePlan, validateData,
  type BackupCounts, type BackupData, type LocalData, type PlanSummary, type RestoreMode, type Row, type TableKey,
} from './backup-core';

export interface BackupDb {
  readProfile(): Promise<Row | null>;
  readSettings(): Promise<Row | null>;
  readAll(table: string): Promise<Row[]>;
  insertRows(table: string, rows: Row[]): Promise<Row[]>;
  upsertRows(table: string, rows: Row[]): Promise<void>;
  deleteRows(table: string, ids: string[]): Promise<void>;
  saveProfile(patch: Row): Promise<void>;
  saveSettings(patch: Row): Promise<void>;
}

export type Connectivity = 'ok' | 'offline' | 'pending_sync';
export interface BackupDeps { db: BackupDb; userId: string; connectivity: () => Connectivity }

export class BackupDbError extends Error {}

const READ_PAGE = 1000;
const WRITE_CHUNK = 200;
const ID_CHUNK = 100;

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const messageOf = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Adapter for the app's Supabase client. Every query is limited to the signed-in user's own rows. */
export function makeSupabaseDb(client: SupabaseClient, userId: string): BackupDb {
  const check = (error: { message: string } | null) => { if (error) throw new BackupDbError(error.message); };
  return {
    async readProfile() {
      const { data, error } = await client.from('profiles').select('*').eq('id', userId).maybeSingle();
      check(error);
      return (data as Row | null) ?? null;
    },
    async readSettings() {
      const { data, error } = await client.from('user_settings').select('*').eq('user_id', userId).maybeSingle();
      check(error);
      return (data as Row | null) ?? null;
    },
    async readAll(table) {
      // The server caps how many rows one request returns, so keep asking until a page comes back empty.
      const out: Row[] = [];
      for (let guard = 0; guard < 2000; guard++) {
        const { data, error } = await client.from(table).select('*').eq('user_id', userId)
          .order('id', { ascending: true }).range(out.length, out.length + READ_PAGE - 1);
        check(error);
        if (!data || data.length === 0) break;
        out.push(...(data as Row[]));
      }
      return out;
    },
    async insertRows(table, rows) {
      const { data, error } = await client.from(table).insert(rows).select('*');
      check(error);
      return (data ?? []) as Row[];
    },
    async upsertRows(table, rows) {
      const { error } = await client.from(table).upsert(rows, { onConflict: 'id' });
      check(error);
    },
    async deleteRows(table, ids) {
      const { error } = await client.from(table).delete().eq('user_id', userId).in('id', ids);
      check(error);
    },
    async saveProfile(patch) {
      const { error } = await client.from('profiles').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', userId);
      check(error);
    },
    async saveSettings(patch) {
      const { error } = await client.from('user_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', userId);
      check(error);
    },
  };
}

export async function collectLocal(db: BackupDb): Promise<LocalData> {
  const [profile, settings, periods, dailyLogs, periodDayLogs] = await Promise.all([
    db.readProfile(), db.readSettings(), db.readAll(TABLE_NAME.periods), db.readAll(TABLE_NAME.dailyLogs), db.readAll(TABLE_NAME.periodDayLogs),
  ]);
  let symptoms: Row[] | null = null;
  try { symptoms = await db.readAll(TABLE_NAME.symptoms); } catch { symptoms = null; }
  return { profile, settings, periods, dailyLogs, periodDayLogs, symptoms };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export type CreateBackupResult =
  | { ok: true; text: string; filename: string; counts: BackupCounts; protectedFile: boolean }
  | { ok: false; code: 'offline' | 'pending_sync' | 'read_failed' | 'self_check_failed' | 'crypto_unavailable'; detail?: string };

export function backupFilename(protectedFile: boolean, now: Date = new Date()): string {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `femcare-backup-${d}${protectedFile ? '-protected' : ''}.json`;
}

export async function createBackup(deps: BackupDeps, opts: { passphrase?: string; now?: Date } = {}): Promise<CreateBackupResult> {
  const conn = deps.connectivity();
  if (conn !== 'ok') return { ok: false, code: conn };
  let local: LocalData;
  try { local = await collectLocal(deps.db); } catch (e) { return { ok: false, code: 'read_failed', detail: messageOf(e) }; }
  const data = buildBackupData(local);
  // Never hand out a file that this app would refuse to restore.
  const check = validateData(JSON.parse(JSON.stringify(data)));
  if (!check.ok) return { ok: false, code: 'self_check_failed', detail: check.errors.join('; ') };
  try {
    const text = await serializeBackup(data, { passphrase: opts.passphrase, now: opts.now });
    const protectedFile = !!opts.passphrase;
    return { ok: true, text, filename: backupFilename(protectedFile, opts.now), counts: { periods: data.periods.length, dailyLogs: data.dailyLogs.length, periodDayLogs: data.periodDayLogs.length, symptoms: data.symptoms?.length ?? 0 }, protectedFile };
  } catch (e) {
    if (messageOf(e) === 'crypto_unavailable') return { ok: false, code: 'crypto_unavailable' };
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

export type PrepareResult =
  | { ok: true; merge: PlanSummary; replace: PlanSummary; local: BackupCounts }
  | { ok: false; code: 'offline' | 'pending_sync' | 'read_failed'; detail?: string };

/** Compares the file with this device so the user can see what each choice would do. Writes nothing. */
export async function prepareRestore(deps: BackupDeps, file: BackupData): Promise<PrepareResult> {
  const conn = deps.connectivity();
  if (conn !== 'ok') return { ok: false, code: conn };
  let local: LocalData;
  try { local = await collectLocal(deps.db); } catch (e) { return { ok: false, code: 'read_failed', detail: messageOf(e) }; }
  return {
    ok: true,
    merge: summarizePlan(planRestore(file, local, 'merge')),
    replace: summarizePlan(planRestore(file, local, 'replace')),
    local: { periods: local.periods.length, dailyLogs: local.dailyLogs.length, periodDayLogs: local.periodDayLogs.length, symptoms: local.symptoms?.length ?? 0 },
  };
}

export interface RestoreCounts { inserted: number; updated: number; removed: number; skipped: number; unchanged: number }
export type RestoreResult =
  | { ok: true; counts: Record<TableKey, RestoreCounts | null>; total: RestoreCounts; profileUpdated: boolean; settingsUpdated: boolean; removalFailed: boolean }
  | { ok: false; code: 'offline' | 'pending_sync' | 'read_failed' | 'failed'; rolledBack: boolean; detail?: string };

interface Journal {
  inserted: Partial<Record<TableKey, string[]>>;
  updated: Partial<Record<TableKey, Row[]>>;
  profile: Row | null;
  settings: Row | null;
}

async function rollback(db: BackupDb, j: Journal): Promise<boolean> {
  let clean = true;
  const attempt = async (fn: () => Promise<void>) => { try { await fn(); } catch { clean = false; } };
  if (j.settings) await attempt(() => db.saveSettings(j.settings as Row));
  if (j.profile) await attempt(() => db.saveProfile(j.profile as Row));
  for (const key of [...TABLE_KEYS].reverse()) {
    for (const ids of chunks(j.inserted[key] ?? [], ID_CHUNK)) await attempt(() => db.deleteRows(TABLE_NAME[key], ids));
  }
  for (const key of TABLE_KEYS) {
    for (const rows of chunks(j.updated[key] ?? [], WRITE_CHUNK)) await attempt(() => db.upsertRows(TABLE_NAME[key], rows));
  }
  return clean;
}

function rowFor(key: TableKey, content: Row, userId: string, idByStart: Map<string, string>): Row {
  if (key === 'periodDayLogs') {
    const start = typeof content.period_start === 'string' ? content.period_start : null;
    const rest: Row = { ...content };
    delete rest.period_start;
    return { ...rest, user_id: userId, period_id: start ? idByStart.get(start) ?? null : null };
  }
  return { ...content, user_id: userId };
}

export async function runRestore(deps: BackupDeps, file: BackupData, mode: RestoreMode): Promise<RestoreResult> {
  const conn = deps.connectivity();
  if (conn !== 'ok') return { ok: false, code: conn, rolledBack: false };
  const { db, userId } = deps;

  // Read fresh data right before writing: the preview may be minutes old.
  let local: LocalData;
  try { local = await collectLocal(db); } catch (e) { return { ok: false, code: 'read_failed', rolledBack: false, detail: messageOf(e) }; }
  const plan = planRestore(file, local, mode);
  const rawByKey: Record<TableKey, Row[]> = { periods: local.periods, dailyLogs: local.dailyLogs, periodDayLogs: local.periodDayLogs, symptoms: local.symptoms ?? [] };
  const journal: Journal = { inserted: {}, updated: {}, profile: null, settings: null };

  const idByStart = new Map<string, string>();
  for (const p of local.periods) { const k = dateOnly(p.start_date); if (!idByStart.has(k)) idByStart.set(k, String(p.id)); }

  try {
    for (const key of TABLE_KEYS) {
      const t = plan.tables[key];
      if (!t) continue;
      const table = TABLE_NAME[key];
      if (t.update.length > 0) {
        const byId = new Map(rawByKey[key].map((r) => [String(r.id), r]));
        journal.updated[key] = t.update.map((u) => byId.get(u.id)).filter((r): r is Row => !!r); // old values, saved before writing
        for (const c of chunks(t.update, WRITE_CHUNK)) await db.upsertRows(table, c.map((u) => ({ id: u.id, ...rowFor(key, u.row, userId, idByStart) })));
      }
      for (const c of chunks(t.insert, WRITE_CHUNK)) {
        const got = await db.insertRows(table, c.map((r) => rowFor(key, r, userId, idByStart)));
        const ids = journal.inserted[key] ?? [];
        ids.push(...got.map((g) => String(g.id)));
        journal.inserted[key] = ids;
        if (got.length !== c.length) throw new BackupDbError('The database did not confirm every added record.');
        if (key === 'periods') for (const g of got) { const k = dateOnly(g.start_date); if (!idByStart.has(k)) idByStart.set(k, String(g.id)); }
      }
    }
    if (plan.profile) { journal.profile = plan.profile.before; await db.saveProfile(plan.profile.patch); }
    if (plan.settings) { journal.settings = plan.settings.before; await db.saveSettings(plan.settings.patch); }
  } catch (e) {
    const clean = await rollback(db, journal);
    return { ok: false, code: 'failed', rolledBack: clean, detail: messageOf(e) };
  }

  // Replace only: remove old rows now that the new data is in place. Child rows first.
  let removalFailed = false;
  const removed: Partial<Record<TableKey, number>> = {};
  for (const key of ['periodDayLogs', 'dailyLogs', 'symptoms', 'periods'] as TableKey[]) {
    const ids = plan.tables[key]?.remove ?? [];
    removed[key] = 0;
    for (const c of chunks(ids, ID_CHUNK)) {
      try { await db.deleteRows(TABLE_NAME[key], c); removed[key] = (removed[key] ?? 0) + c.length; } catch { removalFailed = true; break; }
    }
  }

  const total: RestoreCounts = { inserted: 0, updated: 0, removed: 0, skipped: 0, unchanged: 0 };
  const counts = {} as Record<TableKey, RestoreCounts | null>;
  for (const key of TABLE_KEYS) {
    const t = plan.tables[key];
    if (!t) { counts[key] = null; continue; }
    const c: RestoreCounts = { inserted: t.insert.length, updated: t.update.length, removed: removed[key] ?? 0, skipped: t.skipped, unchanged: t.unchanged };
    counts[key] = c;
    total.inserted += c.inserted; total.updated += c.updated; total.removed += c.removed; total.skipped += c.skipped; total.unchanged += c.unchanged;
  }
  return { ok: true, counts, total, profileUpdated: plan.profile !== null, settingsUpdated: plan.settings !== null, removalFailed };
}
