import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const native = vi.hoisted(() => ({ isNative: false, post: vi.fn() }));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.isNative },
  CapacitorHttp: { post: native.post },
}));

import {
  OVERPASS_ENDPOINTS,
  buildOverpassQuery,
  clearNearbyCache,
  describeAttempts,
  findNearbyPlaces,
  getSearchInfo,
  NEARBY_USER_AGENT,
  NearbySearchError,
  parseOverpassElements,
  setRetryDelay,
} from './overpass';

const LAT = 12.9716;
const LON = 77.5946;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const ok = (elements: unknown[]) => json(200, { elements });

const node = (id: number, dLat: number, tags: Record<string, string> = { amenity: 'pharmacy', name: `N${id}` }) => ({
  type: 'node', id, lat: LAT + dLat, lon: LON, tags,
});
const way = (id: number, dLat: number, tags: Record<string, string> = { amenity: 'hospital', name: `W${id}` }) => ({
  type: 'way', id, center: { lat: LAT + dLat, lon: LON }, tags,
});

let fetchMock: ReturnType<typeof vi.fn>;

async function error(p: Promise<unknown>): Promise<NearbySearchError> {
  try {
    await p;
  } catch (e) {
    return e as NearbySearchError;
  }
  throw new Error('expected the search to fail');
}

beforeEach(() => {
  clearNearbyCache();
  setRetryDelay(0);
  native.isNative = false;
  native.post.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('navigator', { onLine: true });
  const mem = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
  });
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('parser: nodes, ways, relations, missing data', () => {
  it('reads coordinates from lat/lon (nodes) and center (ways and relations)', () => {
    const out = parseOverpassElements([
      node(1, 0.001),
      way(2, 0.002),
      { type: 'relation', id: 3, center: { lat: LAT + 0.003, lon: LON }, tags: { amenity: 'clinic', name: 'R3' } },
    ]);
    expect(out.map((p) => [p.id, p.name, p.lat])).toEqual([
      ['node/1', 'N1', LAT + 0.001],
      ['way/2', 'W2', LAT + 0.002],
      ['relation/3', 'R3', LAT + 0.003],
    ]);
  });

  it('keeps a node and a way that share the same numeric id', () => {
    const out = parseOverpassElements([node(7, 0.001), way(7, 0.002)]);
    expect(out.map((p) => p.id)).toEqual(['node/7', 'way/7']);
  });

  it('skips elements without usable coordinates and never throws on bad input', () => {
    const out = parseOverpassElements([
      null,
      undefined,
      'text',
      42,
      { type: 'way', id: 1, tags: { amenity: 'hospital' } }, // no center
      { type: 'node', id: 2, lat: 'x', lon: 'y', tags: {} },
      { type: 'node', id: 3, lat: NaN, lon: LON, tags: {} },
      { type: 'way', id: 4, center: { lat: Infinity, lon: LON } },
      node(5, 0.001),
    ]);
    expect(out.map((p) => p.id)).toEqual(['node/5']);
  });

  it('handles missing and non-string tags with default names and types', () => {
    const out = parseOverpassElements([
      { type: 'node', id: 1, lat: LAT, lon: LON },
      { type: 'node', id: 2, lat: LAT, lon: LON, tags: { amenity: 'pharmacy', phone: 5 } },
      { type: 'node', id: 3, lat: LAT, lon: LON, tags: { shop: 'supermarket', brand: 'Big Mart' } },
    ]);
    expect(out[0]).toMatchObject({ name: 'Nearby Store', type: 'sanitary', address: 'Address not available' });
    expect(out[1]).toMatchObject({ name: 'Pharmacy', type: 'pharmacy', phone: undefined });
    expect(out[2]).toMatchObject({ name: 'Big Mart', type: 'sanitary' });
  });

  it('removes duplicate elements', () => {
    expect(parseOverpassElements([node(1, 0), node(1, 0)])).toHaveLength(1);
  });
});

describe('query and endpoints', () => {
  it('searches nodes, ways and relations and asks for center coordinates', () => {
    const q = buildOverpassQuery(LAT, LON, 3000, ['pharmacy', 'sanitary']);
    expect(q).toContain(`nwr(around:3000,${LAT},${LON})["amenity"="pharmacy"];`);
    expect(q).toContain('["shop"="supermarket"]');
    expect(q).not.toContain('node(around');
    expect(q.endsWith('out center tags;')).toBe(true);
    expect(q.startsWith('[out:json][timeout:')).toBe(true);
  });

  it('lists only worldwide HTTPS endpoints (not the Switzerland-only instance)', () => {
    expect(OVERPASS_ENDPOINTS.length).toBeGreaterThanOrEqual(2);
    for (const e of OVERPASS_ENDPOINTS) {
      expect(e.startsWith('https://')).toBe(true);
      expect(e).not.toContain('overpass.osm.ch');
    }
  });
});

describe('successful searches', () => {
  it('returns places sorted by distance and sends one form-encoded POST', async () => {
    fetchMock.mockResolvedValueOnce(ok([node(1, 0.02), way(2, 0.001), node(3, 0.01)]));
    const places = await findNearbyPlaces(LAT, LON, 3, ['pharmacy', 'hospital']);
    expect(places.map((p) => p.id)).toEqual(['way/2', 'node/3', 'node/1']);
    expect(places[0].distance).toBeLessThan(places[1].distance);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(OVERPASS_ENDPOINTS[0]);
    expect(init.method).toBe('POST');
    expect(init.body.startsWith('data=')).toBe(true);
    expect(init.headers).toEqual({ 'Content-Type': 'application/x-www-form-urlencoded' });
  });

  it('returns an empty list only for a valid answer with zero elements', async () => {
    fetchMock.mockResolvedValueOnce(ok([]));
    expect(await findNearbyPlaces(LAT, LON, 3, ['pharmacy'])).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('still succeeds when some elements are unusable', async () => {
    fetchMock.mockResolvedValueOnce(ok([null, { type: 'way', id: 9 }, node(1, 0.001)]));
    const places = await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    expect(places).toHaveLength(1);
  });
});

describe('failures are reported, never shown as "no results"', () => {
  it('falls back to the next endpoint after a 429 and then succeeds', async () => {
    fetchMock.mockResolvedValueOnce(json(429, {})).mockResolvedValueOnce(ok([node(1, 0.001)]));
    const places = await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    expect(places).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(OVERPASS_ENDPOINTS[1]);
  });

  it('reports rate limiting when every endpoint answers 429', async () => {
    fetchMock.mockImplementation(async () => json(429, {}));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e).toBeInstanceOf(NearbySearchError);
    expect(e.kind).toBe('rate-limited');
    expect(e.attempts).toHaveLength(2 * OVERPASS_ENDPOINTS.length);
    expect(fetchMock).toHaveBeenCalledTimes(2 * OVERPASS_ENDPOINTS.length); // two passes at most, no hammering
  });

  it('reports a server problem for 5xx answers', async () => {
    fetchMock.mockImplementation(async () => new Response('Server too busy', { status: 504 }));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('server');
    expect(e.attempts[0]).toMatchObject({ status: 504, detail: 'Server too busy' });
  });

  it('treats a 200 answer with a runtime-error remark as a failure and tries the next endpoint', async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, { elements: [], remark: 'runtime error: Query timed out in "query" at line 1' }))
      .mockResolvedValueOnce(ok([node(1, 0.001)]));
    const places = await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    expect(places).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reports a timeout when every endpoint reports a query timeout', async () => {
    fetchMock.mockImplementation(async () => json(200, { elements: [], remark: 'runtime error: Query timed out' }));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('timeout');
  });

  it('reports an invalid response for non-JSON answers', async () => {
    fetchMock.mockImplementation(async () => new Response('<html>Error</html>', { status: 200 }));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('invalid-response');
    expect(e.attempts[0].detail).toContain('<html>');
  });

  it('reports an invalid response when the elements list is missing', async () => {
    fetchMock.mockImplementation(async () => json(200, { version: 0.6 }));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('invalid-response');
  });

  it('stops after the first endpoint when the server rejects the query (HTTP 400)', async () => {
    fetchMock.mockImplementation(async () => new Response('Error: line 1: parse error', { status: 400 }));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('bad-request');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(describeAttempts(e.attempts)).toContain('parse error');
  });

  it('reports a network error when no endpoint can be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('network');
    expect(e.attempts.map((a) => a.outcome)).toEqual([...OVERPASS_ENDPOINTS, ...OVERPASS_ENDPOINTS].map(() => 'network'));
  });

  it('reports a timeout when requests hang past the client limit', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const pending = error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    for (let i = 0; i < 2 * OVERPASS_ENDPOINTS.length; i++) await vi.advanceTimersByTimeAsync(35000);
    const e = await pending;
    expect(e.kind).toBe('timeout');
  });

  it('shows the most informative kind when endpoints fail in different ways', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json(429, {}))
      .mockResolvedValueOnce(new Response('', { status: 503 }));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('rate-limited');
  });

  it('recovers when the first endpoint has a network error and the second works', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(ok([node(1, 0.001)]));
    expect(await findNearbyPlaces(LAT, LON, 3, ['pharmacy'])).toHaveLength(1);
  });

  it('does not search at all when the device is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('offline');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid coordinates, radius and filters without sending a request', async () => {
    for (const args of [
      [91, LON, 3, ['pharmacy']],
      [LAT, 181, 3, ['pharmacy']],
      [NaN, LON, 3, ['pharmacy']],
      [LAT, LON, 0, ['pharmacy']],
      [LAT, LON, 3, []],
    ] as const) {
      const e = await error(findNearbyPlaces(args[0], args[1], args[2], [...args[3]] as never));
      expect(e.kind).toBe('invalid-input');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('request volume', () => {
  it('uses the cache for the same search and recomputes distances from the current position', async () => {
    fetchMock.mockImplementation(async () => ok([node(1, 0.01)]));
    const a = await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    const b = await findNearbyPlaces(LAT + 0.0002, LON, 3, ['pharmacy']); // ~20 m away, same cache cell
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(b[0].distance).not.toBe(a[0].distance);
  });

  it('searches again after the cache is cleared or when the filters change', async () => {
    fetchMock.mockImplementation(async () => ok([node(1, 0.01)]));
    await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    await findNearbyPlaces(LAT, LON, 3, ['hospital']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    clearNearbyCache();
    await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('shares one request between identical searches that run at the same time', async () => {
    fetchMock.mockImplementation(async () => ok([node(1, 0.01)]));
    const [a, b] = await Promise.all([
      findNearbyPlaces(LAT, LON, 3, ['pharmacy']),
      findNearbyPlaces(LAT, LON, 3, ['pharmacy']),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
  });

  it('does not cache a failed search', async () => {
    fetchMock.mockImplementation(async () => json(429, {}));
    await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => ok([node(1, 0.01)]));
    expect(await findNearbyPlaces(LAT, LON, 3, ['pharmacy'])).toHaveLength(1);
  });
});

describe('saved results when servers are busy or the phone is offline', () => {
  const busy = () => new Response('502 at capacity', { status: 502 });
  const dense = [
    node(1, 0.001, { amenity: 'pharmacy', name: 'P near' }),
    node(2, 0.02, { amenity: 'pharmacy', name: 'P far' }),
    node(3, 0.002, { amenity: 'hospital', name: 'H near' }),
    node(4, 0.001, { shop: 'supermarket', name: 'S near' }),
  ];

  async function saveFirst(radiusKm = 5, filters: ('pharmacy' | 'hospital' | 'clinic' | 'sanitary')[] = ['pharmacy', 'hospital', 'sanitary']) {
    fetchMock.mockImplementationOnce(async () => ok(dense));
    const fresh = await findNearbyPlaces(LAT, LON, radiusKm, filters);
    expect(getSearchInfo(fresh).fromSaved).toBe(false);
    clearInMemoryOnly();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => busy());
  }
  // keep the saved copy in localStorage but drop the 5-minute in-memory cache
  function clearInMemoryOnly() {
    const saved = localStorage.getItem('femcare_nearby_saved_v1');
    clearNearbyCache();
    if (saved) localStorage.setItem('femcare_nearby_saved_v1', saved);
  }

  it('shows the saved answer, marked as saved, when every server fails', async () => {
    await saveFirst();
    const out = await findNearbyPlaces(LAT, LON, 5, ['pharmacy', 'hospital', 'sanitary']);
    expect(out.map((p) => p.id).sort()).toEqual(['node/1', 'node/2', 'node/3', 'node/4']);
    const info = getSearchInfo(out);
    expect(info.fromSaved).toBe(true);
    expect(info.reason).toBe('server');
    expect(info.savedAt).toBeGreaterThan(0);
  });

  it('serves a smaller radius and fewer filters from a larger saved search, filtering by type and distance', async () => {
    await saveFirst(5);
    const out = await findNearbyPlaces(LAT, LON, 1, ['pharmacy']);
    expect(out.map((p) => p.id)).toEqual(['node/1']); // 'P far' is ~2.2 km away, hospitals/shops are other types
    expect(getSearchInfo(out).fromSaved).toBe(true);
  });

  it('works offline without sending any request', async () => {
    await saveFirst();
    fetchMock.mockClear();
    vi.stubGlobal('navigator', { onLine: false });
    const out = await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    expect(getSearchInfo(out)).toMatchObject({ fromSaved: true, reason: 'offline' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not use a saved answer that does not cover the request', async () => {
    await saveFirst(3, ['pharmacy']);
    expect((await error(findNearbyPlaces(LAT, LON, 5, ['pharmacy']))).kind).toBe('server'); // larger radius
    expect((await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy', 'hospital']))).kind).toBe('server'); // extra filter
    expect((await error(findNearbyPlaces(LAT + 0.05, LON, 3, ['pharmacy']))).kind).toBe('server'); // moved ~5.5 km
  });

  it('does not use saved answers older than 7 days', async () => {
    await saveFirst();
    const raw = JSON.parse(localStorage.getItem('femcare_nearby_saved_v1')!);
    raw[0].at = Date.now() - 8 * 24 * 3600 * 1000;
    localStorage.setItem('femcare_nearby_saved_v1', JSON.stringify(raw));
    expect((await error(findNearbyPlaces(LAT, LON, 5, ['pharmacy', 'hospital', 'sanitary']))).kind).toBe('server');
  });

  it('never replaces invalid input or a rejected query with saved data', async () => {
    await saveFirst();
    expect((await error(findNearbyPlaces(999, LON, 3, ['pharmacy']))).kind).toBe('invalid-input');
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () => new Response('parse error', { status: 400 }));
    expect((await error(findNearbyPlaces(LAT, LON, 5, ['pharmacy', 'hospital', 'sanitary']))).kind).toBe('bad-request');
  });

  it('still reports an error when nothing was saved, and fresh answers are not marked as saved', async () => {
    fetchMock.mockImplementation(async () => busy());
    expect((await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']))).kind).toBe('server');
  });
});

describe('slow servers do not hold the search up', () => {
  const hang = (_url: string, init: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init.signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });

  it('asks the next server after 4 seconds and uses its answer', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(hang).mockImplementationOnce(async () => ok([node(1, 0.001)]));
    const pending = findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    await vi.advanceTimersByTimeAsync(3900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(200);
    expect((await pending).map((p) => p.id)).toEqual(['node/1']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('moves on at once, without waiting, when a server fails quickly', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementationOnce(async () => new Response('busy', { status: 502 })).mockImplementationOnce(async () => ok([node(1, 0.001)]));
    const pending = findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    await vi.advanceTimersByTimeAsync(10);
    expect(await pending).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('takes the first good answer even if it comes from the slower, earlier request', async () => {
    vi.useFakeTimers();
    fetchMock
      .mockImplementationOnce(() => new Promise<Response>((resolve) => setTimeout(() => resolve(ok([node(1, 0.001)])), 7000)))
      .mockImplementationOnce(hang)
      .mockImplementation(hang);
    const pending = findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    await vi.advanceTimersByTimeAsync(7100);
    expect((await pending).map((p) => p.id)).toEqual(['node/1']);
  });

  it('gives up after 40 seconds with a timeout error that lists the servers it asked', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(hang);
    const pending = error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    await vi.advanceTimersByTimeAsync(41000);
    const e = await pending;
    expect(e.kind).toBe('timeout');
    expect(e.attempts.length).toBe(OVERPASS_ENDPOINTS.length);
    expect(fetchMock).toHaveBeenCalledTimes(OVERPASS_ENDPOINTS.length);
  });
});

describe('overloaded servers ("at capacity")', () => {
  const busy = () => new Response('502 Gateway Timeout. This Overpass API server is currently at capacity.', { status: 502 });

  it('goes through the servers once more after a pause and succeeds if one has recovered', async () => {
    let calls = 0;
    fetchMock.mockImplementation(async () => (++calls <= OVERPASS_ENDPOINTS.length ? busy() : ok([node(1, 0.001)])));
    expect(await findNearbyPlaces(LAT, LON, 3, ['pharmacy'])).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(OVERPASS_ENDPOINTS.length + 1);
  });

  it('waits before the second pass', async () => {
    vi.useFakeTimers();
    setRetryDelay(4000);
    fetchMock.mockImplementation(async () => busy());
    const pending = error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(OVERPASS_ENDPOINTS.length);
    await vi.advanceTimersByTimeAsync(4000);
    const e = await pending;
    expect(fetchMock).toHaveBeenCalledTimes(2 * OVERPASS_ENDPOINTS.length);
    expect(e.kind).toBe('server');
  });

  it('does not retry servers that rejected the request', async () => {
    fetchMock.mockImplementation(async () => new Response('Not Acceptable', { status: 406 }));
    await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(fetchMock).toHaveBeenCalledTimes(OVERPASS_ENDPOINTS.length);
  });
});

describe('HTTP 403 / 406 answers (seen on overpass-api.de from the Android app)', () => {
  it('classifies 406 as rejected, keeps the server text, and tries the next endpoint', async () => {
    fetchMock
      .mockImplementationOnce(async () => new Response('<html><title>406 Not Acceptable</title></html>', { status: 406 }))
      .mockImplementationOnce(async () => ok([node(1, 0.001)]));
    const places = await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    expect(places).toHaveLength(1);
    expect(fetchMock.mock.calls[1][0]).toBe(OVERPASS_ENDPOINTS[1]);
  });

  it('reproduces the reported failure: 406, 429, 5xx on three servers is reported with all three reasons', async () => {
    fetchMock
      .mockImplementationOnce(async () => new Response('<html><title>406 Not Acceptable</title></html>', { status: 406 }))
      .mockImplementationOnce(async () => json(429, {}))
      .mockImplementationOnce(async () => new Response('<html>504 Gateway Time-out</html>', { status: 504 }))
      .mockImplementationOnce(async () => new Response('<html>504 Gateway Time-out</html>', { status: 504 }));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.attempts.slice(0, 4).map((a) => [a.outcome, a.status])).toEqual([
      ['rejected', 406],
      ['rate-limited', 429],
      ['server', 504],
      ['server', 504],
    ]);
    expect(e.kind).toBe('rate-limited');
  });

  it('reports a rejected request when every server answers 406', async () => {
    fetchMock.mockImplementation(async () => new Response('Not Acceptable', { status: 406 }));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('rejected');
  });
});

describe('Android native transport (used first inside the APK)', () => {
  const nativeOk = (elements: unknown[]) => ({ status: 200, data: JSON.stringify({ elements }) });

  it('uses native HTTP first, with a descriptive User-Agent, and never calls fetch when it works', async () => {
    native.isNative = true;
    native.post.mockResolvedValue(nativeOk([node(1, 0.001)]));
    const places = await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    expect(places).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
    const opts = native.post.mock.calls[0][0];
    expect(opts.url).toBe(OVERPASS_ENDPOINTS[0]);
    expect(opts.headers['User-Agent']).toBe(NEARBY_USER_AGENT);
    expect(opts.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(opts.data.data).toContain('nwr(around:3000');
    expect(opts.responseType).toBe('text');
  });

  it('treats a native 406 as the server\'s answer and moves to the next endpoint without using fetch', async () => {
    native.isNative = true;
    native.post
      .mockResolvedValueOnce({ status: 406, data: '<html>406 Not Acceptable</html>' })
      .mockResolvedValueOnce(nativeOk([node(1, 0.001)]));
    expect(await findNearbyPlaces(LAT, LON, 3, ['pharmacy'])).toHaveLength(1);
    expect(native.post.mock.calls[1][0].url).toBe(OVERPASS_ENDPOINTS[1]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to fetch for an endpoint when the native request cannot connect', async () => {
    native.isNative = true;
    native.post.mockRejectedValue(new Error('Unable to resolve host'));
    fetchMock.mockImplementation(async () => ok([node(1, 0.001)]));
    expect(await findNearbyPlaces(LAT, LON, 3, ['pharmacy'])).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops using the native plugin after it reports it is not implemented', async () => {
    native.isNative = true;
    native.post.mockRejectedValue(new Error('"CapacitorHttp" plugin is not implemented on android'));
    fetchMock.mockImplementation(async () => ok([node(1, 0.001)]));
    await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    await findNearbyPlaces(LAT, LON, 5, ['pharmacy']);
    expect(native.post).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry with fetch after a native timeout', async () => {
    native.isNative = true;
    native.post.mockRejectedValue(new Error('SocketTimeoutException: timeout'));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('timeout');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a network error when both native and fetch fail', async () => {
    native.isNative = true;
    native.post.mockRejectedValue(new Error('Unable to resolve host'));
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    expect(e.kind).toBe('network');
  });

  it('uses plain fetch in a normal browser', async () => {
    native.isNative = false;
    fetchMock.mockImplementation(async () => ok([node(1, 0.001)]));
    await findNearbyPlaces(LAT, LON, 3, ['pharmacy']);
    expect(native.post).not.toHaveBeenCalled();
  });
});

describe('diagnostics text', () => {
  it('lists each endpoint, outcome and status for the technical details line', async () => {
    fetchMock.mockImplementation(async () => new Response('busy', { status: 503 }));
    const e = await error(findNearbyPlaces(LAT, LON, 3, ['pharmacy']));
    const text = describeAttempts(e.attempts);
    expect(text).toContain('overpass-api.de: server HTTP 503');
    expect(text.split('\n')).toHaveLength(2 * OVERPASS_ENDPOINTS.length);
  });
});
