// Offline support for FemCare+.
//
// How it works
// ------------
// The Supabase client is created with `createOfflineFetch()` as its fetch function. Every
// request to one of the user's own tables (/rest/v1/<table>) goes through it:
//   * Online:  the request is sent normally. Successful reads and writes are also copied
//              into a local mirror on the device (localStorage, one store per user).
//   * Offline: reads are answered from the local mirror and writes are applied to the
//              mirror AND added to a queue. The screens behave as if the server answered.
//   * Back online: queued writes are sent in their original order before the next
//              request. Rows get client-generated ids, so a retried insert cannot
//              create a duplicate.
// Everything else (login, token refresh, other APIs) is passed straight through.
//
// Known limits (also listed in the paper): last-write-wins on conflicts, only simple
// filters are supported offline (eq, neq, gt, gte, lt, lte, in, is), and the local copy
// is not encrypted beyond the app's private storage.

type Row = Record<string, unknown>;

export const OFFLINE_TABLES = [
  'profiles',
  'periods',
  'daily_logs',
  'period_day_logs',
  'emergency_contacts',
  'user_settings',
  'chat_messages',
] as const;
type Table = (typeof OFFLINE_TABLES)[number];

// Mirrors the UNIQUE constraints in the database so offline writes fail the same way.
const UNIQUE_KEYS: Partial<Record<Table, string[]>> = {
  daily_logs: ['user_id', 'log_date'],
  period_day_logs: ['user_id', 'log_date'],
  user_settings: ['user_id'],
};

// Rows that the database deletes automatically when their parent is deleted.
const CASCADES: Partial<Record<Table, { child: Table; column: string }[]>> = {
  periods: [{ child: 'period_day_logs', column: 'period_id' }],
};

const REQUEST_TIMEOUT_MS = 10000;
const STORE_PREFIX = 'femcare_offline_v1:';
const MAX_DROPPED_LOG = 20;

interface QueueItem {
  id: string;
  table: Table;
  method: 'POST' | 'PATCH' | 'DELETE';
  url: string;
  body?: string;
  createdAt: string;
}

interface DroppedItem {
  at: string;
  table: string;
  method: string;
  status: number;
  message: string;
}

interface UserStore {
  rows: Partial<Record<Table, Row[]>>; // undefined = never downloaded
  queue: QueueItem[];
  dropped: DroppedItem[];
}

export interface OfflineStatus {
  online: boolean;
  pending: number;
  syncing: boolean;
  dropped: number;
}

type FetchFn = typeof fetch;

// ---------------------------------------------------------------- status

let networkDown = false;
let syncing = false;
let status: OfflineStatus = { online: true, pending: 0, syncing: false, dropped: 0 };
const listeners = new Set<() => void>();
let activeUserId: string | null = null;

function browserOnline(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function refreshStatus() {
  const st = activeUserId ? stores.get(activeUserId) : undefined;
  const next: OfflineStatus = {
    online: browserOnline() && !networkDown,
    pending: st?.queue.length ?? 0,
    syncing,
    dropped: st?.dropped.length ?? 0,
  };
  if (
    next.online !== status.online ||
    next.pending !== status.pending ||
    next.syncing !== status.syncing ||
    next.dropped !== status.dropped
  ) {
    status = next;
    listeners.forEach((l) => l());
  }
}

export function getOfflineStatus(): OfflineStatus {
  return status;
}

export function subscribeOfflineStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setNetworkDown(value: boolean) {
  networkDown = value;
  refreshStatus();
}

// ---------------------------------------------------------------- local storage

const stores = new Map<string, UserStore>();

function emptyStore(): UserStore {
  return { rows: {}, queue: [], dropped: [] };
}

function getStore(userId: string): UserStore {
  let st = stores.get(userId);
  if (st) return st;
  st = emptyStore();
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORE_PREFIX + userId) : null;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserStore>;
      st = { rows: parsed.rows ?? {}, queue: parsed.queue ?? [], dropped: parsed.dropped ?? [] };
    }
  } catch {
    /* corrupt data: start empty */
  }
  stores.set(userId, st);
  return st;
}

function persist(userId: string) {
  const st = stores.get(userId);
  if (!st) return;
  try {
    localStorage.setItem(STORE_PREFIX + userId, JSON.stringify(st));
  } catch {
    /* storage full or unavailable: keep working in memory */
  }
}

/** Remove the local copy for a user. Keeps it if unsynced changes are still queued, unless forced. */
export function releaseUserData(userId: string, force = false): boolean {
  const st = getStore(userId);
  if (st.queue.length > 0 && !force) return false;
  stores.delete(userId);
  try {
    localStorage.removeItem(STORE_PREFIX + userId);
  } catch {
    /* ignore */
  }
  if (activeUserId === userId) activeUserId = null;
  refreshStatus();
  return true;
}

// ---------------------------------------------------------------- helpers

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function userIdFromHeaders(headers: Headers): string | null {
  const auth = headers.get('authorization');
  if (!auth || !/^bearer /i.test(auth)) return null;
  const parts = auth.slice(7).split('.');
  if (parts.length < 2) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const payload = JSON.parse(atob(b64)) as { sub?: unknown };
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

function json(status: number, data: unknown, statusText = ''): Response {
  if (status === 204 || data === null) return new Response(null, { status, statusText });
  return new Response(JSON.stringify(data), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/json' },
  });
}

function pgError(status: number, code: string, message: string, details: string | null = null): Response {
  return json(status, { code, details, hint: null, message });
}

function cmp(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

// ---------------------------------------------------------------- query evaluation

interface ParsedQuery {
  select: string[] | null; // null = all columns
  filters: { column: string; op: string; value: string }[];
  order: { column: string; desc: boolean }[];
  limit: number | null;
  offset: number;
  complex: boolean; // uses features we cannot evaluate offline
}

const RESERVED_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

function parseQuery(url: URL): ParsedQuery {
  const q: ParsedQuery = { select: null, filters: [], order: [], limit: null, offset: 0, complex: false };
  url.searchParams.forEach((value, key) => {
    if (key === 'select') {
      if (value && value !== '*') {
        if (/[()!:]/.test(value)) q.complex = true; // joins / embedded resources
        else q.select = value.split(',').map((c) => c.trim()).filter(Boolean);
      }
    } else if (key === 'order') {
      q.order = value.split(',').map((part) => {
        const [column, ...mods] = part.split('.');
        return { column, desc: mods.includes('desc') };
      });
    } else if (key === 'limit') {
      q.limit = Number(value);
    } else if (key === 'offset') {
      q.offset = Number(value) || 0;
    } else if (!RESERVED_PARAMS.has(key)) {
      if (key === 'or' || key === 'and' || key === 'not') {
        q.complex = true;
        return;
      }
      const dot = value.indexOf('.');
      if (dot < 0) {
        q.complex = true;
        return;
      }
      const op = value.slice(0, dot);
      if (!['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is'].includes(op)) q.complex = true;
      q.filters.push({ column: key, op, value: value.slice(dot + 1) });
    }
  });
  return q;
}

function matches(row: Row, filters: ParsedQuery['filters']): boolean {
  return filters.every(({ column, op, value }) => {
    const v = row[column];
    switch (op) {
      case 'eq':
        return v !== null && v !== undefined && String(v) === value;
      case 'neq':
        return v === null || v === undefined || String(v) !== value;
      case 'is':
        return value === 'null' ? v === null || v === undefined : String(v) === value;
      case 'in': {
        const list = value.replace(/^\(|\)$/g, '').split(',').map((s) => s.replace(/^"|"$/g, ''));
        return v !== null && v !== undefined && list.includes(String(v));
      }
      case 'gt':
        return v != null && cmp(v, typeof v === 'number' ? Number(value) : value) > 0;
      case 'gte':
        return v != null && cmp(v, typeof v === 'number' ? Number(value) : value) >= 0;
      case 'lt':
        return v != null && cmp(v, typeof v === 'number' ? Number(value) : value) < 0;
      case 'lte':
        return v != null && cmp(v, typeof v === 'number' ? Number(value) : value) <= 0;
      default:
        return false;
    }
  });
}

function runSelect(rows: Row[], q: ParsedQuery): Row[] {
  let out = rows.filter((r) => matches(r, q.filters));
  if (q.order.length) {
    out = [...out].sort((a, b) => {
      for (const { column, desc } of q.order) {
        const av = a[column];
        const bv = b[column];
        const aNull = av === null || av === undefined;
        const bNull = bv === null || bv === undefined;
        if (aNull && bNull) continue;
        // Postgres default: NULLs sort last when ascending, first when descending.
        if (aNull) return desc ? -1 : 1;
        if (bNull) return desc ? 1 : -1;
        const c = cmp(av, bv);
        if (c !== 0) return desc ? -c : c;
      }
      return 0;
    });
  }
  if (q.offset) out = out.slice(q.offset);
  if (q.limit !== null && !Number.isNaN(q.limit)) out = out.slice(0, q.limit);
  if (q.select) {
    const cols = q.select;
    out = out.map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
  }
  return out.map((r) => ({ ...r }));
}

// ---------------------------------------------------------------- local mutations

function tableRows(st: UserStore, table: Table): Row[] {
  return (st.rows[table] ??= []);
}

function upsertRows(st: UserStore, table: Table, incoming: Row[]) {
  const rows = tableRows(st, table);
  for (const row of incoming) {
    const idx = row.id !== undefined ? rows.findIndex((r) => r.id === row.id) : -1;
    if (idx >= 0) rows[idx] = { ...rows[idx], ...row };
    else rows.push({ ...row });
  }
}

class ConflictError extends Error {}

function localInsert(st: UserStore, table: Table, userId: string, incoming: Row[]): Row[] {
  const rows = tableRows(st, table);
  const unique = UNIQUE_KEYS[table];
  const created: Row[] = [];
  for (const raw of incoming) {
    const row: Row = { ...raw };
    if (table !== 'profiles' && !row.id) row.id = uuid();
    if (table !== 'profiles' && row.user_id === undefined) row.user_id = userId;
    if (row.created_at === undefined) row.created_at = new Date().toISOString();
    const clash = rows.some(
      (r) =>
        (row.id !== undefined && r.id === row.id) ||
        (unique && unique.every((k) => r[k] !== undefined && r[k] === row[k])),
    );
    if (clash) throw new ConflictError(`duplicate key value violates unique constraint on ${table}`);
    created.push(row);
    rows.push(row);
  }
  return created;
}

function localUpdate(st: UserStore, table: Table, q: ParsedQuery, patch: Row): Row[] {
  const changed: Row[] = [];
  for (const r of tableRows(st, table)) {
    if (matches(r, q.filters)) {
      Object.assign(r, patch);
      changed.push({ ...r });
    }
  }
  return changed;
}

function localDelete(st: UserStore, table: Table, q: ParsedQuery): Row[] {
  const rows = tableRows(st, table);
  const removed = rows.filter((r) => matches(r, q.filters));
  st.rows[table] = rows.filter((r) => !removed.includes(r));
  for (const { child, column } of CASCADES[table] ?? []) {
    if (st.rows[child]) {
      const ids = new Set(removed.map((r) => r.id));
      st.rows[child] = st.rows[child]!.filter((r) => !ids.has(r[column]));
    }
  }
  return removed;
}

// ---------------------------------------------------------------- request plumbing

interface ParsedRequest {
  url: URL;
  method: string;
  headers: Headers;
  body?: string;
  table: Table;
  userId: string;
}

function parseRequest(input: RequestInfo | URL, init?: RequestInit): ParsedRequest | null {
  let url: URL;
  try {
    url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  } catch {
    return null;
  }
  if (!url.pathname.startsWith('/rest/v1/')) return null;
  const table = url.pathname.slice('/rest/v1/'.length) as Table;
  if (!OFFLINE_TABLES.includes(table)) return null;
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  const headers = new Headers(init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined));
  if (init?.body !== undefined && init.body !== null && typeof init.body !== 'string') return null;
  const userId = userIdFromHeaders(headers);
  if (!userId) return null;
  return { url, method, headers, body: (init?.body as string | undefined) ?? undefined, table, userId };
}

async function fetchWithTimeout(realFetch: FetchFn, url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const outer = init.signal;
  const onAbort = () => controller.abort();
  if (outer) {
    if (outer.aborted) controller.abort();
    else outer.addEventListener('abort', onAbort, { once: true });
  }
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await realFetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener('abort', onAbort);
  }
}

function wantsRepresentation(headers: Headers): boolean {
  return (headers.get('prefer') ?? '').includes('return=representation');
}

function wantsSingleObject(headers: Headers): boolean {
  return (headers.get('accept') ?? '').includes('application/vnd.pgrst.object+json');
}

function representationResponse(status: number, rows: Row[], headers: Headers): Response {
  if (wantsSingleObject(headers)) {
    if (rows.length !== 1) {
      return pgError(
        406,
        'PGRST116',
        'JSON object requested, multiple (or no) rows returned',
        `The result contains ${rows.length} rows`,
      );
    }
    return json(status, rows[0]);
  }
  return json(status, rows);
}

function parseBody(body?: string): Row[] | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as Row | Row[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return null;
  }
}

function isFullSnapshot(table: Table, userId: string, q: ParsedQuery): boolean {
  if (q.limit !== null || q.offset || q.select) return false;
  const key = table === 'profiles' ? 'id' : 'user_id';
  return q.filters.every((f) => f.column === key && f.op === 'eq' && f.value === userId);
}

// ---------------------------------------------------------------- sync

let flushing: Promise<void> | null = null;

function replayHeaders(source: Headers): Headers {
  const h = new Headers();
  for (const name of ['apikey', 'authorization']) {
    const v = source.get(name);
    if (v) h.set(name, v);
  }
  h.set('Content-Type', 'application/json');
  h.set('Prefer', 'return=minimal');
  return h;
}

async function flushQueue(userId: string, authSource: Headers, realFetch: FetchFn): Promise<void> {
  const st = getStore(userId);
  if (st.queue.length === 0) return;
  if (flushing) return flushing;
  flushing = (async () => {
    syncing = true;
    refreshStatus();
    try {
      while (st.queue.length > 0) {
        const item = st.queue[0];
        let res: Response;
        try {
          res = await fetchWithTimeout(realFetch, item.url, {
            method: item.method,
            headers: replayHeaders(authSource),
            body: item.body,
          });
        } catch {
          setNetworkDown(true);
          throw new Error('offline');
        }
        if (res.ok) {
          st.queue.shift();
        } else if (res.status === 401 || res.status === 429 || res.status >= 500) {
          throw new Error(`retry later (${res.status})`);
        } else {
          // Permanent failure for this change (for example a conflict). Do not block the rest.
          let message = res.statusText;
          let code = '';
          try {
            const err = (await res.json()) as { message?: string; code?: string };
            message = err.message ?? message;
            code = err.code ?? '';
          } catch {
            /* ignore */
          }
          const alreadyApplied = item.method === 'POST' && code === '23505' && /pkey/.test(message);
          if (!alreadyApplied) {
            st.dropped.push({ at: new Date().toISOString(), table: item.table, method: item.method, status: res.status, message });
            if (st.dropped.length > MAX_DROPPED_LOG) st.dropped.shift();
          }
          st.queue.shift();
        }
        persist(userId);
        refreshStatus();
      }
      setNetworkDown(false);
    } finally {
      syncing = false;
      flushing = null;
      persist(userId);
      refreshStatus();
    }
  })();
  return flushing;
}

// ---------------------------------------------------------------- the fetch wrapper

export function createOfflineFetch(realFetch: FetchFn = (...args) => fetch(...args)): FetchFn {
  return async function offlineFetch(input, init) {
    const req = parseRequest(input, init);
    if (!req) return realFetch(input, init);

    const { userId, headers } = req;
    activeUserId = userId;
    const st = getStore(userId);
    refreshStatus();

    // 1. Online: push older offline changes first, then send this request.
    if (browserOnline()) {
      try {
        await flushQueue(userId, headers, realFetch);
      } catch {
        /* still offline or server busy: fall through to the local path */
      }
      if (st.queue.length === 0) {
        try {
          return await networkPath(req, init, st, realFetch);
        } catch (err) {
          if (init?.signal?.aborted) throw err;
          setNetworkDown(true); // network failure: use the local copy
        }
      }
    }

    // 2. Offline (or queue not empty yet): answer from the local copy.
    return localPath(req, st);
  };
}

async function networkPath(req: ParsedRequest, init: RequestInit | undefined, st: UserStore, realFetch: FetchFn): Promise<Response> {
  const { url, method, headers, table, userId } = req;
  const q = parseQuery(url);
  let body = req.body;
  let rows = parseBody(body);

  // Give new rows an id on the device so that a retried insert can never create a duplicate.
  if (method === 'POST' && rows && table !== 'profiles') {
    rows = rows.map((r) => (r.id ? r : { ...r, id: uuid() }));
    body = JSON.stringify(Array.isArray(JSON.parse(req.body ?? '[]')) ? rows : rows[0]);
  }

  const res = await fetchWithTimeout(realFetch, url.href, { ...init, method, headers, body });
  setNetworkDown(false);
  if (!res.ok) return res;

  try {
    if (method === 'GET') {
      if (!q.complex && !q.select) {
        const data = (await res.clone().json()) as Row | Row[];
        const list = Array.isArray(data) ? data : [data];
        if (isFullSnapshot(table, userId, q)) st.rows[table] = list.map((r) => ({ ...r }));
        else upsertRows(st, table, list);
      }
    } else if (method === 'POST' && rows) {
      if (wantsRepresentation(headers)) {
        const data = (await res.clone().json()) as Row | Row[];
        upsertRows(st, table, Array.isArray(data) ? data : [data]);
      } else {
        for (const r of rows) {
          upsertRows(st, table, [{ user_id: userId, created_at: new Date().toISOString(), ...r }]);
        }
      }
    } else if (method === 'PATCH' && rows?.[0]) {
      if (wantsRepresentation(headers)) {
        const data = (await res.clone().json()) as Row | Row[];
        upsertRows(st, table, Array.isArray(data) ? data : [data]);
      } else {
        localUpdate(st, table, q, rows[0]);
      }
    } else if (method === 'DELETE') {
      localDelete(st, table, q);
    }
    persist(userId);
  } catch {
    /* the mirror is best-effort; never break a successful request */
  }
  return res;
}

function localPath(req: ParsedRequest, st: UserStore): Response {
  const { url, method, headers, table, userId } = req;
  const q = parseQuery(url);
  if (q.complex) throw new TypeError('Failed to fetch'); // cannot be answered offline
  const queue = (body?: string) => {
    st.queue.push({ id: uuid(), table, method: method as QueueItem['method'], url: url.href, body, createdAt: new Date().toISOString() });
    persist(userId);
    refreshStatus();
  };

  if (method === 'GET') {
    if (st.rows[table] === undefined) throw new TypeError('Failed to fetch'); // never downloaded
    const out = runSelect(st.rows[table]!, q);
    return wantsSingleObject(headers) ? representationResponse(200, out, headers) : json(200, out);
  }

  const rows = parseBody(req.body);

  if (method === 'POST') {
    if (!rows) return pgError(400, 'PGRST102', 'Invalid request body');
    if (st.rows[table] === undefined) st.rows[table] = [];
    let created: Row[];
    try {
      created = localInsert(st, table, userId, rows);
    } catch (e) {
      if (e instanceof ConflictError) return pgError(409, '23505', e.message);
      throw e;
    }
    persist(userId);
    // Queue exactly what was stored locally (with id and created_at) so the replay matches.
    const sent = created.map((r) => {
      const { id, created_at } = r;
      const original = rows[created.indexOf(r)] ?? {};
      return table === 'profiles' ? original : { ...original, id, created_at };
    });
    queue(JSON.stringify(Array.isArray(JSON.parse(req.body ?? '[]')) ? sent : sent[0]));
    return wantsRepresentation(headers) ? representationResponse(201, created, headers) : json(201, null);
  }

  if (method === 'PATCH') {
    if (!rows?.[0]) return pgError(400, 'PGRST102', 'Invalid request body');
    if (st.rows[table] === undefined) throw new TypeError('Failed to fetch');
    const changed = localUpdate(st, table, q, rows[0]);
    persist(userId);
    queue(req.body);
    return wantsRepresentation(headers) ? representationResponse(200, changed, headers) : json(204, null);
  }

  if (method === 'DELETE') {
    if (st.rows[table] === undefined) throw new TypeError('Failed to fetch');
    const removed = localDelete(st, table, q);
    persist(userId);
    queue();
    return wantsRepresentation(headers) ? representationResponse(200, removed, headers) : json(204, null);
  }

  throw new TypeError('Failed to fetch');
}

// ---------------------------------------------------------------- app integration

let syncHook: (() => Promise<unknown>) | null = null;

/** Register a function that makes one harmless request, which triggers a sync when online. */
export function setSyncHook(hook: () => Promise<unknown>) {
  syncHook = hook;
}

export function requestSync() {
  if (syncHook && browserOnline()) void syncHook().catch(() => undefined);
}

let listenersInstalled = false;

export function installOfflineListeners() {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;
  window.addEventListener('online', () => {
    networkDown = false;
    refreshStatus();
    requestSync();
  });
  window.addEventListener('offline', () => refreshStatus());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && status.pending > 0) requestSync();
  });
  refreshStatus();
}

/** Read the signed-in user from the stored login session, for starting the app without internet. */
export function readCachedSessionUser<T = { id: string }>(storageKey: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: T };
    return parsed.user ?? null;
  } catch {
    return null;
  }
}
