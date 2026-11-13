import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';

type Row = Record<string, unknown>;
const USER = 'user-1';

function fakeJwt(sub: string): string {
  const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'none' })}.${b64({ sub, role: 'authenticated' })}.sig`;
}

class Backend {
  tables: Record<string, Row[]> = {};
  up = true;
  fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!this.up) throw new TypeError('Failed to fetch');
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers);
    const table = url.pathname.replace('/rest/v1/', '');
    const rows = (this.tables[table] ??= []);
    const filters: [string, string][] = [];
    url.searchParams.forEach((v, k) => { if (v.startsWith('eq.')) filters.push([k, v.slice(3)]); });
    const match = (r: Row) => filters.every(([k, v]) => String(r[k]) === v);
    const send = (status: number, data?: unknown) =>
      new Response(data === undefined ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
    const conflict = (msg: string) => send(409, { code: '23505', message: msg, details: null, hint: null });
    const body = init?.body ? JSON.parse(init.body as string) : undefined;

    if (method === 'GET') return send(200, rows.filter(match));
    if (method === 'POST') {
      const list: Row[] = Array.isArray(body) ? body : [body];
      for (const r of list) {
        if (rows.some((x) => x.id === r.id)) return conflict('duplicate key (pkey)');
        if (table === 'symptom_alerts' && rows.some((x) => x.user_id === r.user_id && x.cycle_key === r.cycle_key)) {
          return conflict('duplicate key (user_id, cycle_key)');
        }
      }
      rows.push(...list.map((r) => ({ created_at: '2026-01-01T00:00:00Z', ...r })));
      return (headers.get('Prefer') ?? '').includes('return=representation') ? send(201, list) : send(201);
    }
    if (method === 'PATCH') { rows.filter(match).forEach((r) => Object.assign(r, body)); return send(204); }
    if (method === 'DELETE') { this.tables[table] = rows.filter((r) => !match(r)); return send(204); }
    return send(405);
  };
}

// Fresh module state on every call, like reopening the app. The stored data (localStorage) is kept.
async function setup(existing?: Backend) {
  vi.resetModules();
  const off = await import('./offline');
  const backend = existing ?? new Backend();
  const client = createClient('https://example.supabase.co', fakeJwt(USER), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: off.createOfflineFetch(backend.fetch) },
  });
  return { off, backend, client };
}

beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
    key: (i: number) => [...data.keys()][i] ?? null,
    get length() { return data.size; },
  });
});

describe('symptom alerts offline', () => {
  it('shows alerts offline once they were loaded online', async () => {
    const { client, backend } = await setup();
    backend.tables.symptom_alerts = [
      { id: 'a1', user_id: USER, cycle_key: '2026-01-01', matched: ['cramps'], level: 'possible', created_at: '2026-01-02T00:00:00Z' },
    ];
    await client.from('symptom_alerts').select('*').eq('user_id', USER);
    backend.up = false;
    const res = await client.from('symptom_alerts').select('id, matched, level').eq('user_id', USER).eq('cycle_key', '2026-01-01');
    expect(res.error).toBeNull();
    expect(res.data).toEqual([{ id: 'a1', matched: ['cramps'], level: 'possible' }]);
  });

  it('allows one alert per cycle offline (same error as the database) and syncs it once', async () => {
    const { client, backend, off } = await setup();
    await client.from('symptom_alerts').select('*').eq('user_id', USER);
    backend.up = false;
    const first = await client.from('symptom_alerts').insert({ user_id: USER, cycle_key: '2026-02-01', matched: ['cramps'], level: 'possible' });
    expect(first.error).toBeNull();
    const again = await client.from('symptom_alerts').insert({ user_id: USER, cycle_key: '2026-02-01', matched: ['headache'], level: 'strong' });
    expect(again.error?.code).toBe('23505');
    expect(off.getOfflineStatus().pending).toBe(1);
    backend.up = true;
    await client.from('symptom_alerts').select('*').eq('user_id', USER);
    await vi.waitFor(() => {
      expect(backend.tables.symptom_alerts).toHaveLength(1);
      expect(off.getOfflineStatus().pending).toBe(0);
    }, { timeout: 2000 });
  });
});

describe('chat history offline', () => {
  it('keeps history and unsent messages after the app is closed and reopened', async () => {
    let ctx = await setup();
    const backend = ctx.backend;
    backend.tables.chat_history = [
      { id: 'c1', user_id: USER, mode: 'general', sender: 'user', message: 'hello', created_at: '2000-01-01T00:00:00Z' },
    ];
    const read = (c: typeof ctx) =>
      c.client.from('chat_history').select('*').eq('user_id', USER).order('created_at', { ascending: true }).limit(200);
    await read(ctx);
    backend.up = false;
    const sent = await ctx.client.from('chat_history').insert({ user_id: USER, mode: 'general', sender: 'user', message: 'saved offline' });
    expect(sent.error).toBeNull();

    ctx = await setup(backend); // app closed and reopened, still no connection
    const after = await read(ctx);
    expect(after.data?.map((m: Row) => m.message)).toEqual(['hello', 'saved offline']);
    expect(ctx.off.getOfflineStatus().pending).toBe(1);

    backend.up = true;
    await ctx.client.from('chat_history').select('*').eq('user_id', USER);
    await vi.waitFor(() => {
      expect(backend.tables.chat_history.map((m) => m.message)).toEqual(['hello', 'saved offline']);
    }, { timeout: 2000 });
  });
});

describe('symptoms table offline', () => {
  it('logs, edits and reads symptoms offline and syncs without duplicates', async () => {
    const { client, backend } = await setup();
    await client.from('symptoms').select('*').eq('user_id', USER);
    backend.up = false;
    const ins = await client.from('symptoms').insert({ user_id: USER, entry_date: '2026-03-01', symptoms: ['cramps'], pain: 3 });
    expect(ins.error).toBeNull();
    const seen = await client.from('symptoms').select('*').eq('user_id', USER);
    expect(seen.data).toHaveLength(1);
    await client.from('symptoms').update({ pain: 5 }).eq('user_id', USER).eq('entry_date', '2026-03-01');
    backend.up = true;
    await client.from('symptoms').select('*').eq('user_id', USER);
    await vi.waitFor(() => {
      expect(backend.tables.symptoms).toHaveLength(1);
      expect(backend.tables.symptoms[0].pain).toBe(5);
    }, { timeout: 2000 });
  });
});