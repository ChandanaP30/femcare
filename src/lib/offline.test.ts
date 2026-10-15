import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ---------- test doubles: a tiny fake backend, a fake network switch, fake localStorage ----------

type Row = Record<string, unknown>;
const USER = 'user-1';

function fakeJwt(sub: string | null): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'none' })}.${b64(sub ? { sub, role: 'authenticated' } : { role: 'anon' })}.sig`;
}

class FakeBackend {
  tables: Record<string, Row[]> = {};
  up = true;
  calls: { method: string; table: string; body: unknown; query: string }[] = [];
  rejectNextWith: { status: number; code: string; message: string } | null = null;
  failAfter: number | null = null; // network drops after N successful calls

  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!this.up) throw new TypeError('Failed to fetch');
    if (this.failAfter !== null) {
      if (this.failAfter <= 0) throw new TypeError('Failed to fetch');
      this.failAfter -= 1;
    }
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers);
    const table = url.pathname.replace('/rest/v1/', '');
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    this.calls.push({ method, table, body, query: url.search });
    const rows = (this.tables[table] ??= []);
    const filters: [string, string][] = [];
    url.searchParams.forEach((v, k) => {
      if (v.startsWith('eq.')) filters.push([k, v.slice(3)]);
    });
    const match = (r: Row) => filters.every(([k, v]) => String(r[k]) === v);
    const ok = (status: number, data: unknown) =>
      new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const err = (status: number, code: string, message: string) => ok(status, { code, message, details: null, hint: null });

    if (this.rejectNextWith && method !== 'GET') {
      const r = this.rejectNextWith;
      this.rejectNextWith = null;
      return err(r.status, r.code, r.message);
    }
    if (method === 'GET') return ok(200, rows.filter(match));
    if (method === 'POST') {
      const list: Row[] = Array.isArray(body) ? body : [body];
      const made: Row[] = [];
      for (const r of list) {
        const row: Row = { id: r.id ?? `srv-${rows.length + 1}`, created_at: '2026-01-01T00:00:00Z', ...r };
        if (rows.some((x) => x.id === row.id)) return err(409, '23505', 'duplicate key value violates unique constraint "x_pkey"');
        if (table === 'daily_logs' && rows.some((x) => x.user_id === row.user_id && x.log_date === row.log_date)) {
          return err(409, '23505', 'duplicate key value violates unique constraint "daily_logs_user_id_log_date_key"');
        }
        rows.push(row);
        made.push(row);
      }
      const wantsRep = (headers.get('prefer') ?? '').includes('return=representation');
      return wantsRep ? ok(201, headers.get('accept')?.includes('pgrst.object') ? made[0] : made) : ok(201, undefined);
    }
    if (method === 'PATCH') {
      const hit = rows.filter(match);
      hit.forEach((r) => Object.assign(r, body));
      const wantsRep = (headers.get('prefer') ?? '').includes('return=representation');
      return wantsRep ? ok(200, headers.get('accept')?.includes('pgrst.object') ? hit[0] : hit) : ok(204, undefined);
    }
    if (method === 'DELETE') {
      this.tables[table] = rows.filter((r) => !match(r));
      return ok(204, undefined);
    }
    return err(400, 'x', 'unsupported');
  };
}

function installBrowserFakes() {
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  });
  vi.stubGlobal('navigator', { onLine: true });
}

function setOnline(value: boolean, backend: FakeBackend) {
  (navigator as { onLine: boolean }).onLine = value;
  backend.up = value;
}

async function setup() {
  const mod = await import('./offline');
  const backend = new FakeBackend();
  const client: SupabaseClient = createClient('https://test.supabase.co', 'anon-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: mod.createOfflineFetch(backend.fetch as typeof fetch), headers: { Authorization: `Bearer ${fakeJwt(USER)}` } },
  });
  return { mod, backend, client };
}

beforeEach(() => {
  vi.resetModules();
  installBrowserFakes();
});

const seed = (b: FakeBackend) => {
  b.tables.periods = [{ id: 'p1', user_id: USER, start_date: '2026-09-01', end_date: '2026-09-05' }];
  b.tables.period_day_logs = [{ id: 'd1', user_id: USER, period_id: 'p1', log_date: '2026-09-01' }];
  b.tables.daily_logs = [{ id: 'l1', user_id: USER, log_date: '2026-09-02', mood: 'ok' }];
  b.tables.user_settings = [{ id: 's1', user_id: USER, language: 'hi' }];
};
const warm = async (client: SupabaseClient) => {
  for (const t of ['periods', 'period_day_logs', 'daily_logs', 'user_settings']) {
    await client.from(t).select('*').eq('user_id', USER);
  }
};

// ---------------------------------------------------------------------------------------

describe('reading offline', () => {
  it('serves data that was downloaded while online', async () => {
    const { backend, client } = await setup();
    seed(backend);
    await warm(client);
    const callsBefore = backend.calls.length;
    setOnline(false, backend);
    const { data, error } = await client.from('periods').select('*').eq('user_id', USER).order('start_date', { ascending: false });
    expect(error).toBeNull();
    expect(data).toEqual([expect.objectContaining({ id: 'p1', start_date: '2026-09-01' })]);
    expect(backend.calls.length).toBe(callsBefore); // answered locally
  });

  it('supports single(), maybeSingle() and column selection like the server', async () => {
    const { backend, client } = await setup();
    seed(backend);
    await warm(client);
    setOnline(false, backend);
    const one = await client.from('daily_logs').select('*').eq('user_id', USER).eq('log_date', '2026-09-02').single();
    expect(one.data).toEqual(expect.objectContaining({ mood: 'ok' }));
    const none = await client.from('daily_logs').select('*').eq('user_id', USER).eq('log_date', '2000-01-01').maybeSingle();
    expect(none.data).toBeNull();
    expect(none.error).toBeNull();
    const missing = await client.from('daily_logs').select('*').eq('log_date', '2000-01-01').single();
    expect(missing.error?.code).toBe('PGRST116');
    const lang = await client.from('user_settings').select('language').eq('user_id', USER).maybeSingle();
    expect(lang.data).toEqual({ language: 'hi' });
  });

  it('returns a network error for a table that was never downloaded', async () => {
    const { backend, client } = await setup();
    setOnline(false, backend);
    const { error } = await client.from('periods').select('*').eq('user_id', USER);
    expect(error).not.toBeNull();
  });
});

describe('writing offline', () => {
  it('inserts, updates and deletes locally and shows the changes immediately', async () => {
    const { backend, client, mod } = await setup();
    seed(backend);
    await warm(client);
    setOnline(false, backend);

    const ins = await client.from('periods').insert({ user_id: USER, start_date: '2026-10-01', end_date: null }).select().single();
    expect(ins.error).toBeNull();
    const newId = (ins.data as Row).id as string;
    expect(newId).toBeTruthy();

    await client.from('periods').update({ end_date: '2026-10-05' }).eq('id', newId);
    let list = (await client.from('periods').select('*').eq('user_id', USER).order('start_date', { ascending: false })).data as Row[];
    expect(list.map((r) => r.start_date)).toEqual(['2026-10-01', '2026-09-01']);
    expect(list[0].end_date).toBe('2026-10-05');

    await client.from('periods').delete().eq('id', 'p1');
    list = (await client.from('periods').select('*').eq('user_id', USER)).data as Row[];
    expect(list.map((r) => r.id)).toEqual([newId]);
    expect(mod.getOfflineStatus().pending).toBe(3);
    expect(mod.getOfflineStatus().online).toBe(false);
  });

  it('deleting a period also removes its day logs locally, as the database does', async () => {
    const { backend, client } = await setup();
    seed(backend);
    await warm(client);
    setOnline(false, backend);
    await client.from('periods').delete().eq('id', 'p1');
    const logs = (await client.from('period_day_logs').select('*').eq('user_id', USER)).data as Row[];
    expect(logs).toEqual([]);
  });

  it('rejects a duplicate daily log with the same error code as the database', async () => {
    const { backend, client } = await setup();
    seed(backend);
    await warm(client);
    setOnline(false, backend);
    const dup = await client.from('daily_logs').insert({ user_id: USER, log_date: '2026-09-02', mood: 'bad' });
    expect(dup.error?.code).toBe('23505');
    expect(dup.status).toBe(409);
  });

  it('inserts several rows at once (array insert)', async () => {
    const { backend, client } = await setup();
    seed(backend);
    await warm(client);
    setOnline(false, backend);
    const res = await client.from('period_day_logs').insert([
      { user_id: USER, period_id: 'p1', log_date: '2026-09-02' },
      { user_id: USER, period_id: 'p1', log_date: '2026-09-03' },
    ]);
    expect(res.error).toBeNull();
    const logs = (await client.from('period_day_logs').select('*').eq('user_id', USER).order('log_date', { ascending: true })).data as Row[];
    expect(logs.map((r) => r.log_date)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
  });
});

describe('syncing after reconnecting', () => {
  it('sends queued changes in order, keeps client ids, and empties the queue', async () => {
    const { backend, client, mod } = await setup();
    seed(backend);
    await warm(client);
    setOnline(false, backend);

    const ins = await client.from('periods').insert({ user_id: USER, start_date: '2026-10-01', end_date: null }).select().single();
    const newId = (ins.data as Row).id as string;
    await client.from('periods').update({ end_date: '2026-10-05' }).eq('id', newId);
    await client.from('daily_logs').insert({ user_id: USER, log_date: '2026-10-02', mood: 'good' });
    backend.calls.length = 0;

    setOnline(true, backend);
    await client.from('periods').select('*').eq('user_id', USER); // any request triggers the sync

    const writes = backend.calls.filter((c) => c.method !== 'GET').map((c) => `${c.method} ${c.table}`);
    expect(writes).toEqual(['POST periods', 'PATCH periods', 'POST daily_logs']);
    const server = backend.tables.periods.find((r) => r.id === newId);
    expect(server).toEqual(expect.objectContaining({ start_date: '2026-10-01', end_date: '2026-10-05' }));
    expect(mod.getOfflineStatus().pending).toBe(0);
    expect(mod.getOfflineStatus().online).toBe(true);
  });

  it('does not duplicate a row when an insert is retried after a lost response', async () => {
    const { backend, client } = await setup();
    seed(backend);
    await warm(client);
    setOnline(false, backend);
    const ins = await client.from('periods').insert({ user_id: USER, start_date: '2026-10-01' }).select().single();
    const newId = (ins.data as Row).id as string;
    // The server already has the row (the first attempt succeeded but the phone never heard back).
    backend.tables.periods.push({ id: newId, user_id: USER, start_date: '2026-10-01' });
    setOnline(true, backend);
    await client.from('periods').select('*').eq('user_id', USER);
    expect(backend.tables.periods.filter((r) => r.id === newId)).toHaveLength(1);
  });

  it('drops a conflicting change, reports it, and still sends the rest', async () => {
    const { backend, client, mod } = await setup();
    seed(backend);
    await warm(client);
    setOnline(false, backend);
    await client.from('daily_logs').insert({ user_id: USER, log_date: '2026-10-02', mood: 'a' });
    await client.from('daily_logs').insert({ user_id: USER, log_date: '2026-10-03', mood: 'b' });
    setOnline(true, backend);
    backend.rejectNextWith = { status: 409, code: '23505', message: 'duplicate key value violates unique constraint "daily_logs_user_id_log_date_key"' };
    await client.from('daily_logs').select('*').eq('user_id', USER);
    expect(backend.tables.daily_logs.map((r) => r.log_date)).toEqual(['2026-09-02', '2026-10-03']);
    expect(mod.getOfflineStatus().pending).toBe(0);
    expect(mod.getOfflineStatus().dropped).toBe(1);
  });

  it('keeps unsent changes when the connection drops during sync, and finishes later', async () => {
    const { backend, client, mod } = await setup();
    seed(backend);
    await warm(client);
    setOnline(false, backend);
    for (const d of ['2026-10-02', '2026-10-03', '2026-10-04']) {
      await client.from('daily_logs').insert({ user_id: USER, log_date: d, mood: 'x' });
    }
    setOnline(true, backend);
    backend.failAfter = 1; // only one request gets through
    await client.from('daily_logs').select('*').eq('user_id', USER);
    expect(mod.getOfflineStatus().pending).toBe(2);
    // the user still sees all three entries meanwhile
    const local = (await client.from('daily_logs').select('*').eq('user_id', USER)).data as Row[];
    expect(local).toHaveLength(4);
    backend.failAfter = null;
    await client.from('daily_logs').select('*').eq('user_id', USER);
    expect(mod.getOfflineStatus().pending).toBe(0);
    expect(backend.tables.daily_logs).toHaveLength(4);
  });
});

describe('writing while online', () => {
  it('gives new rows a client-generated id and keeps the local copy current', async () => {
    const { backend, client } = await setup();
    seed(backend);
    await warm(client);
    await client.from('periods').insert({ user_id: USER, start_date: '2026-10-01' });
    const sent = backend.calls.find((c) => c.method === 'POST' && c.table === 'periods')!;
    const id = (Array.isArray(sent.body) ? sent.body[0] : sent.body).id;
    expect(typeof id).toBe('string');
    setOnline(false, backend);
    const local = (await client.from('periods').select('*').eq('user_id', USER)).data as Row[];
    expect(local.map((r) => r.id)).toContain(id);
  });
});

describe('restarting the app and other edge cases', () => {
  it('keeps the local copy and the queue after the app is closed and reopened', async () => {
    const first = await setup();
    seed(first.backend);
    await warm(first.client);
    setOnline(false, first.backend);
    await first.client.from('daily_logs').insert({ user_id: USER, log_date: '2026-10-02', mood: 'x' });

    vi.resetModules(); // simulate a new app launch: memory cleared, localStorage kept
    const second = await setup();
    second.backend.tables = first.backend.tables;
    setOnline(false, second.backend);
    const logs = (await second.client.from('daily_logs').select('*').eq('user_id', USER)).data as Row[];
    expect(logs.map((r) => r.log_date)).toContain('2026-10-02');
    setOnline(true, second.backend);
    await second.client.from('daily_logs').select('*').eq('user_id', USER);
    expect(second.backend.tables.daily_logs.map((r) => r.log_date)).toContain('2026-10-02');
  });

  it('does not touch requests without a signed-in user or for other tables', async () => {
    const mod = await import('./offline');
    const calls: string[] = [];
    const real = (async (input: RequestInfo | URL) => {
      calls.push(String(input));
      return new Response('[]', { status: 200 });
    }) as typeof fetch;
    const wrapped = mod.createOfflineFetch(real);
    const anon = createClient('https://test.supabase.co', 'anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: wrapped, headers: { Authorization: `Bearer ${fakeJwt(null)}` } },
    });
    await anon.from('periods').select('*');
    await wrapped('https://test.supabase.co/auth/v1/token', { method: 'POST' });
    await wrapped('https://test.supabase.co/rest/v1/some_other_table');
    expect(calls).toHaveLength(3);
  });

  it('removes the local copy on sign-out only when nothing is waiting to sync', async () => {
    const { backend, client, mod } = await setup();
    seed(backend);
    await warm(client);
    setOnline(false, backend);
    await client.from('daily_logs').insert({ user_id: USER, log_date: '2026-10-02', mood: 'x' });
    expect(mod.releaseUserData(USER)).toBe(false); // unsynced change: keep it
    setOnline(true, backend);
    await client.from('daily_logs').select('*').eq('user_id', USER);
    expect(mod.releaseUserData(USER)).toBe(true);
    expect(localStorage.getItem(`femcare_offline_v1:${USER}`)).toBeNull();
  });
});
