import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { NearbyPlace } from './types';

// ---------------------------------------------------------------------------
// Nearby-services search using the OpenStreetMap Overpass API.
//
// Design notes
//  * Only WORLDWIDE public Overpass instances are listed (see the OSM wiki page
//    "Overpass API", section "Public Overpass API instances"). The Swiss instance
//    (overpass.osm.ch) holds data for Switzerland only: for coordinates in India it
//    answers HTTP 200 with zero elements, which the app used to show as "No results".
//  * Every failure keeps its own kind (offline, network, timeout, rate-limited, server,
//    bad-request, invalid-response, invalid-input). A failed search NEVER returns an
//    empty list; only a valid answer with zero elements does.
//  * At most one request per endpoint per search (max 3), identical searches are
//    cached for 5 minutes and identical in-flight searches share one request.
//  * Parsing problems are reported as "invalid-response", never as network errors.
// ---------------------------------------------------------------------------

export const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter', // main public instance (round-robin over its own servers)
  'https://lz4.overpass-api.de/api/interpreter', // one of the main instance's own servers, tried directly
  'https://overpass.private.coffee/api/interpreter', // global (formerly overpass.kumi.systems)
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter', // VK Maps, global
];

// Sent by the Android (native) transport. Public Overpass servers ask clients to identify themselves
// and have answered "406 Not Acceptable" to anonymous or browser-like requests.
export const NEARBY_USER_AGENT = 'FemCarePlus/1.0 (Android app; nearby pharmacies and clinics)';

const SERVER_TIMEOUT_S = 25; // Overpass stops the query after this many seconds
const CLIENT_TIMEOUT_MS = 35000; // the app waits a little longer than the server
const TOTAL_BUDGET_MS = 40000; // give up after this long (saved results are shown if there are any)
const HEDGE_DELAY_MS = 4000; // if a server has not answered after this long, ask the next one too
const CACHE_TTL_MS = 5 * 60 * 1000;

// When every server is overloaded ("at capacity"), wait a few seconds and go through the list once more.
let retryDelayMs = 4000;
export function setRetryDelay(ms: number): void {
  retryDelayMs = ms;
}
const RETRYABLE: NearbyErrorKind[] = ['rate-limited', 'server', 'timeout', 'network'];
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type PlaceFilter = 'pharmacy' | 'hospital' | 'clinic' | 'sanitary';

export const FILTER_CONFIG: Record<PlaceFilter, { label: string; queries: string[] }> = {
  pharmacy: {
    label: 'Pharmacies',
    queries: ['["amenity"="pharmacy"]', '["shop"="chemist"]'],
  },
  hospital: {
    label: 'Hospitals',
    queries: ['["amenity"="hospital"]'],
  },
  clinic: {
    label: 'Clinics',
    queries: ['["amenity"="clinic"]', '["healthcare"="clinic"]'],
  },
  sanitary: {
    label: 'Sanitary Products',
    queries: ['["shop"="convenience"]', '["shop"="supermarket"]', '["shop"="variety_store"]'],
  },
};

// ------------------------------------------------------------------ errors

export type NearbyErrorKind =
  | 'offline'
  | 'network'
  | 'timeout'
  | 'rate-limited'
  | 'rejected'
  | 'server'
  | 'bad-request'
  | 'invalid-response'
  | 'invalid-input';

export interface AttemptReport {
  endpoint: string;
  outcome: NearbyErrorKind | 'ok';
  status?: number;
  detail?: string;
  ms: number;
}

const DEFAULT_MESSAGES: Record<NearbyErrorKind, string> = {
  offline: 'You appear to be offline. Nearby search needs internet.',
  network: 'Could not reach the map servers. Check your internet connection and try again.',
  timeout: 'The search took too long. Try a smaller radius or try again.',
  'rate-limited': 'The map servers are busy (too many requests). Please wait a minute and try again.',
  rejected: 'A map server refused the request from this app. Please try again later.',
  server: 'The map servers had a problem. Please try again in a moment.',
  'bad-request': 'The map server rejected the search request.',
  'invalid-response': 'The map servers sent an answer the app could not read.',
  'invalid-input': 'The coordinates or radius are not valid.',
};

export class NearbySearchError extends Error {
  readonly kind: NearbyErrorKind;
  readonly attempts: AttemptReport[];
  constructor(kind: NearbyErrorKind, attempts: AttemptReport[] = [], message?: string) {
    super(message ?? DEFAULT_MESSAGES[kind]);
    this.name = 'NearbySearchError';
    this.kind = kind;
    this.attempts = attempts;
  }
}

/** One line per endpoint, for showing technical details under the error message. */
export function describeAttempts(attempts: AttemptReport[]): string {
  return attempts
    .map((a) => {
      let host = a.endpoint;
      try {
        host = new URL(a.endpoint).hostname;
      } catch {
        /* keep raw */
      }
      const status = a.status ? ` HTTP ${a.status}` : '';
      const detail = a.detail ? ` (${a.detail})` : '';
      return `${host}: ${a.outcome}${status}${detail} ${(a.ms / 1000).toFixed(1)}s`;
    })
    .join('\n');
}

class TransportError extends Error {
  constructor(
    readonly kind: 'timeout' | 'network',
    message: string,
  ) {
    super(message);
  }
}

class AttemptFailure extends Error {
  constructor(
    readonly kind: Exclude<NearbyErrorKind, 'offline' | 'invalid-input'>,
    readonly status?: number,
    readonly detail?: string,
  ) {
    super(kind);
  }
}

// ------------------------------------------------------------------ query

export function buildOverpassQuery(lat: number, lon: number, radiusM: number, filters: PlaceFilter[]): string {
  const parts: string[] = [];
  for (const filter of filters) {
    for (const q of FILTER_CONFIG[filter].queries) {
      // nwr = nodes, ways and relations (many shops and hospitals are mapped as building outlines)
      parts.push(`nwr(around:${radiusM},${lat},${lon})${q};`);
    }
  }
  return `[out:json][timeout:${SERVER_TIMEOUT_S}];(${parts.join('')});out center tags;`;
}

// ------------------------------------------------------------------ parsing

interface OverpassElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, string>;
}

export interface ParsedPlace {
  id: string;
  name: string;
  type: string;
  lat: number;
  lon: number;
  address: string;
  phone?: string;
  tags: Record<string, string>;
}

function isCoord(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function coordinatesOf(el: OverpassElement): { lat: number; lon: number } | null {
  if (isCoord(el.lat) && isCoord(el.lon)) return { lat: el.lat, lon: el.lon }; // nodes
  if (el.center && isCoord(el.center.lat) && isCoord(el.center.lon)) return { lat: el.center.lat, lon: el.center.lon }; // ways, relations
  return null;
}

function cleanTags(raw: unknown): Record<string, string> {
  const tags: Record<string, string> = {};
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === 'string') tags[k] = v;
    }
  }
  return tags;
}

/**
 * Converts Overpass elements into places. Never throws: elements without usable
 * coordinates are skipped, missing tags become {}, and ids are unique per object type
 * (a node and a way can share the same number in OpenStreetMap).
 */
export function parseOverpassElements(elements: unknown[]): ParsedPlace[] {
  const seen = new Set<string>();
  const places: ParsedPlace[] = [];
  for (const item of elements) {
    if (!item || typeof item !== 'object') continue;
    const el = item as OverpassElement;
    const pos = coordinatesOf(el);
    if (!pos) continue;
    const tags = cleanTags(el.tags);
    const id = typeof el.id === 'number' ? `${typeof el.type === 'string' ? el.type : 'node'}/${el.id}` : `${pos.lat},${pos.lon}`;
    if (seen.has(id)) continue;
    seen.add(id);
    places.push({
      id,
      name: tags.name || tags['name:en'] || tags.brand || getDefaultName(tags),
      type: getPlaceType(tags),
      lat: pos.lat,
      lon: pos.lon,
      address: formatAddress(tags),
      phone: tags.phone || tags['contact:phone'] || undefined,
      tags,
    });
  }
  return places;
}

function withDistances(parsed: ParsedPlace[], lat: number, lon: number): NearbyPlace[] {
  return parsed
    .map((p) => ({ ...p, distance: haversineDistance(lat, lon, p.lat, p.lon), open: null as boolean | null }))
    .sort((a, b) => a.distance - b.distance);
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

function getDefaultName(tags: Record<string, string>): string {
  if (tags.amenity === 'pharmacy') return 'Pharmacy';
  if (tags.amenity === 'hospital') return 'Hospital';
  if (tags.amenity === 'clinic' || tags.healthcare === 'clinic') return 'Clinic';
  if (tags.shop === 'convenience') return 'Convenience Store';
  if (tags.shop === 'supermarket') return 'Supermarket';
  if (tags.shop === 'chemist') return 'Chemist';
  if (tags.shop === 'variety_store') return 'Variety Store';
  return 'Nearby Store';
}

function getPlaceType(tags: Record<string, string>): string {
  if (tags.amenity === 'pharmacy' || tags.shop === 'chemist') return 'pharmacy';
  if (tags.amenity === 'hospital') return 'hospital';
  if (tags.amenity === 'clinic' || tags.healthcare === 'clinic') return 'clinic';
  return 'sanitary';
}

function formatAddress(tags: Record<string, string>): string {
  const parts: string[] = [];
  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:street']} ${tags['addr:housenumber']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }
  if (tags['addr:suburb']) parts.push(tags['addr:suburb']);
  if (tags['addr:city']) parts.push(tags['addr:city']);
  if (tags['addr:postcode']) parts.push(tags['addr:postcode']);
  return parts.join(', ') || 'Address not available';
}

// ------------------------------------------------------------------ transport

interface RawResponse {
  status: number;
  text: string;
}

function isNative(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

async function sendWithFetch(endpoint: string, query: string): Promise<RawResponse> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CLIENT_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      body: 'data=' + encodeURIComponent(query),
      signal: controller.signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return { status: response.status, text: await response.text() };
  } catch (err) {
    if (timedOut) throw new TransportError('timeout', 'client timeout');
    throw new TransportError('network', err instanceof Error ? err.message : String(err));
  } finally {
    clearTimeout(timer);
  }
}

// Native HTTP (Android) sends no browser Origin header, is not subject to WebView CORS rules and lets
// us send a descriptive User-Agent. Overpass has answered browser-style requests with HTTP 406, so on
// Android the native transport is tried FIRST; normal fetch is only the fallback when the native plugin
// is unavailable or cannot connect.
let nativeUnavailable = false;

async function sendNative(endpoint: string, query: string): Promise<RawResponse> {
  try {
    const res = await CapacitorHttp.post({
      url: endpoint,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': NEARBY_USER_AGENT,
        Accept: '*/*',
      },
      data: { data: query },
      connectTimeout: CLIENT_TIMEOUT_MS,
      readTimeout: CLIENT_TIMEOUT_MS,
      responseType: 'text',
    });
    return { status: res.status, text: typeof res.data === 'string' ? res.data : JSON.stringify(res.data) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/not implemented|not available|unimplemented/i.test(msg)) nativeUnavailable = true;
    throw new TransportError(/time ?out|timed out/i.test(msg) ? 'timeout' : 'network', msg);
  }
}

async function send(endpoint: string, query: string): Promise<RawResponse> {
  if (isNative() && !nativeUnavailable) {
    try {
      return await sendNative(endpoint, query);
    } catch (err) {
      if (err instanceof TransportError && err.kind === 'timeout') throw err; // the server was reached but too slow
      // otherwise fall through and try the normal fetch once for this endpoint
    }
  }
  return sendWithFetch(endpoint, query);
}

function snippet(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 120);
}

/** Turns an HTTP answer into the list of elements, or throws a classified AttemptFailure. */
function interpret(res: RawResponse): unknown[] {
  if (res.status === 429) throw new AttemptFailure('rate-limited', res.status);
  if (res.status === 408) throw new AttemptFailure('timeout', res.status);
  if (res.status === 400) throw new AttemptFailure('bad-request', res.status, snippet(res.text));
  if (res.status === 403 || res.status === 406) throw new AttemptFailure('rejected', res.status, snippet(res.text));
  if (res.status < 200 || res.status >= 300) throw new AttemptFailure('server', res.status, snippet(res.text));

  let data: unknown;
  try {
    data = JSON.parse(res.text);
  } catch {
    throw new AttemptFailure('invalid-response', res.status, snippet(res.text) || 'empty body');
  }
  if (!data || typeof data !== 'object') throw new AttemptFailure('invalid-response', res.status, 'not a JSON object');
  const body = data as { elements?: unknown; remark?: unknown };

  // Overpass reports some failures as HTTP 200 with a "remark" (and possibly partial data).
  if (typeof body.remark === 'string' && /runtime error/i.test(body.remark)) {
    throw new AttemptFailure(/timed out/i.test(body.remark) ? 'timeout' : 'server', res.status, snippet(body.remark));
  }
  if (!Array.isArray(body.elements)) throw new AttemptFailure('invalid-response', res.status, 'no elements list');
  return body.elements;
}

// ------------------------------------------------------------------ search

const KIND_PRIORITY: NearbyErrorKind[] = ['rate-limited', 'rejected', 'server', 'timeout', 'invalid-response', 'network'];

function finalError(attempts: AttemptReport[]): NearbySearchError {
  const bad = attempts.find((a) => a.outcome === 'bad-request');
  if (bad) return new NearbySearchError('bad-request', attempts);
  const kinds = attempts.map((a) => a.outcome).filter((o): o is NearbyErrorKind => o !== 'ok');
  const kind = KIND_PRIORITY.find((k) => kinds.includes(k)) ?? 'network';
  return new NearbySearchError(kind, attempts);
}

// ------------------------------------------------------------------ saved results (fallback)
// The last real answers are kept on the phone. When the servers are busy or the phone is offline, a
// saved answer that fully covers the request (same area, radius and filters or larger) is shown instead,
// and the screen says so. Nothing is invented: these are earlier answers from the Overpass servers.

const SAVED_KEY = 'femcare_nearby_saved_v1';
const SAVED_MAX = 12;
const SAVED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface SavedEntry {
  at: number;
  lat: number;
  lon: number;
  radiusM: number;
  filters: PlaceFilter[];
  parsed: ParsedPlace[];
}

export interface SearchInfo {
  fromSaved: boolean;
  savedAt: number | null;
  reason: NearbyErrorKind | null;
}
const searchInfo = new WeakMap<object, SearchInfo>();

/** Saved earlier answer that fully covers this request, if any (shown at once while a fresh search runs). */
export function getSavedPlaces(lat: number, lon: number, radiusKm: number, filters: PlaceFilter[]): { places: NearbyPlace[]; at: number } | null {
  if (!isCoord(lat) || !isCoord(lon) || !isCoord(radiusKm) || radiusKm <= 0 || filters.length === 0) return null;
  return savedResults(lat, lon, Math.round(radiusKm * 1000), filters);
}

/** Tells whether a result list came from the servers or from a saved earlier answer. */
export function getSearchInfo(results: NearbyPlace[]): SearchInfo {
  return searchInfo.get(results) ?? { fromSaved: false, savedAt: null, reason: null };
}

function loadSaved(): SavedEntry[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(SAVED_KEY) : null;
    const list = raw ? (JSON.parse(raw) as SavedEntry[]) : [];
    return Array.isArray(list) ? list.filter((e) => e && Array.isArray(e.parsed) && Array.isArray(e.filters)) : [];
  } catch {
    return [];
  }
}

function writeSaved(entries: SavedEntry[]): void {
  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(entries));
  } catch {
    /* storage full or unavailable */
  }
}

function saveResult(lat: number, lon: number, radiusM: number, filters: PlaceFilter[], parsed: ParsedPlace[]): void {
  const sortedKey = [...filters].sort().join(',');
  const others = loadSaved().filter(
    (e) =>
      !(e.radiusM === radiusM && e.lat.toFixed(3) === lat.toFixed(3) && e.lon.toFixed(3) === lon.toFixed(3) && [...e.filters].sort().join(',') === sortedKey),
  );
  writeSaved([{ at: Date.now(), lat, lon, radiusM, filters, parsed }, ...others].slice(0, SAVED_MAX));
}

function savedResults(lat: number, lon: number, radiusM: number, filters: PlaceFilter[]): { places: NearbyPlace[]; at: number } | null {
  const entries = loadSaved().sort((a, b) => b.at - a.at);
  for (const e of entries) {
    if (Date.now() - e.at > SAVED_TTL_MS) continue;
    if (!filters.every((f) => e.filters.includes(f))) continue;
    const shiftM = haversineDistance(e.lat, e.lon, lat, lon) * 1000;
    if (shiftM + radiusM > e.radiusM) continue; // the saved search must fully cover the requested circle
    const wanted = e.parsed.filter((p) => filters.includes(p.type as PlaceFilter) && haversineDistance(lat, lon, p.lat, p.lon) * 1000 <= radiusM);
    return { places: withDistances(wanted, lat, lon), at: e.at };
  }
  return null;
}

export function clearNearbyCache(): void {
  cache.clear();
  inflight.clear();
  nativeUnavailable = false;
  try {
    localStorage.removeItem(SAVED_KEY);
  } catch {
    /* ignore */
  }
}

const cache = new Map<string, { at: number; parsed: ParsedPlace[] }>();
const inflight = new Map<string, Promise<ParsedPlace[]>>();


// Servers are tried one after another. A server that fails (502, 504, ...) is skipped at once, but a
// server that is merely slow does not hold the search up: after HEDGE_DELAY_MS the next server is asked as
// well, and the first good answer wins. At most 2 passes over the servers and TOTAL_BUDGET_MS in total.
function runSearch(query: string): Promise<ParsedPlace[]> {
  return new Promise<ParsedPlace[]>((resolve, reject) => {
    const started = Date.now();
    const attempts: AttemptReport[] = [];
    const waiting = new Map<string, number>(); // endpoint -> start time of requests still open
    let queue = [...OVERPASS_ENDPOINTS];
    let failedRetryable: string[] = [];
    let round = 1;
    let inFlight = 0;
    let settled = false;
    let hedgeTimer: ReturnType<typeof setTimeout> | null = null;

    const deadline = setTimeout(() => {
      finish(() => {
        for (const [endpoint, t0] of waiting) {
          attempts.push({ endpoint, outcome: 'timeout', detail: 'no answer before the time limit', ms: Date.now() - t0 });
        }
        reject(finalError(attempts));
      });
    }, TOTAL_BUDGET_MS);

    function finish(action: () => void) {
      if (settled) return;
      settled = true;
      if (hedgeTimer) clearTimeout(hedgeTimer);
      clearTimeout(deadline);
      action();
    }

    function armHedge() {
      if (hedgeTimer || settled || queue.length === 0) return;
      hedgeTimer = setTimeout(() => {
        hedgeTimer = null;
        if (settled || queue.length === 0) return;
        launch();
        armHedge();
      }, HEDGE_DELAY_MS);
    }

    function pump() {
      if (settled) return;
      if (queue.length > 0) {
        if (inFlight === 0) launch(); // nothing is waiting, so go on at once
        armHedge();
        return;
      }
      if (inFlight > 0) return; // wait for the requests still open
      if (round === 1 && failedRetryable.length > 0 && Date.now() - started < TOTAL_BUDGET_MS - 15000) {
        round = 2;
        queue = failedRetryable;
        failedRetryable = [];
        void sleep(retryDelayMs).then(pump);
        return;
      }
      finish(() => reject(finalError(attempts)));
    }

    function launch() {
      const endpoint = queue.shift();
      if (!endpoint) return;
      inFlight++;
      const t0 = Date.now();
      waiting.set(endpoint, t0);
      send(endpoint, query)
        .then((res) => ({ res, parsed: parseOverpassElements(interpret(res)) }))
        .then(({ res, parsed }) => {
          if (settled) return;
          attempts.push({ endpoint, outcome: 'ok', status: res.status, ms: Date.now() - t0 });
          finish(() => resolve(parsed));
        })
        .catch((err: unknown) => {
          if (settled) return;
          const ms = Date.now() - t0;
          let report: AttemptReport;
          if (err instanceof AttemptFailure) {
            report = { endpoint, outcome: err.kind, status: err.status, detail: err.detail, ms };
          } else if (err instanceof TransportError) {
            report = { endpoint, outcome: err.kind, detail: err.message, ms };
          } else {
            report = { endpoint, outcome: 'invalid-response', detail: err instanceof Error ? err.message : String(err), ms };
          }
          attempts.push(report);
          console.warn('[nearby] attempt failed', report);
          if (report.outcome === 'bad-request') finish(() => reject(finalError(attempts))); // the same query fails everywhere
          else if (RETRYABLE.includes(report.outcome as NearbyErrorKind)) failedRetryable.push(endpoint);
        })
        .finally(() => {
          waiting.delete(endpoint);
          inFlight--;
          pump();
        });
    }

    pump();
  });
}

export async function findNearbyPlaces(
  lat: number,
  lon: number,
  radiusKm: number,
  filters: PlaceFilter[],
): Promise<NearbyPlace[]> {
  if (
    !isCoord(lat) || !isCoord(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180 ||
    !isCoord(radiusKm) || radiusKm <= 0 || radiusKm > 50 || filters.length === 0
  ) {
    throw new NearbySearchError('invalid-input');
  }

  const radiusM = Math.round(radiusKm * 1000);
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}|${radiusM}|${[...filters].sort().join(',')}`;

  try {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new NearbySearchError('offline');

    let parsed: ParsedPlace[];
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      parsed = hit.parsed;
    } else {
      let pending = inflight.get(key);
      if (!pending) {
        pending = runSearch(buildOverpassQuery(lat, lon, radiusM, filters)).then((result) => {
          cache.set(key, { at: Date.now(), parsed: result });
          saveResult(lat, lon, radiusM, filters, result);
          return result;
        });
        inflight.set(key, pending);
        const release = () => void inflight.delete(key);
        pending.then(release, release);
      }
      parsed = await pending;
    }
    const fresh = withDistances(parsed, lat, lon);
    searchInfo.set(fresh, { fromSaved: false, savedAt: null, reason: null });
    return fresh;
  } catch (err) {
    if (err instanceof NearbySearchError && err.kind !== 'bad-request' && err.kind !== 'invalid-input') {
      const saved = savedResults(lat, lon, radiusM, filters);
      if (saved) {
        searchInfo.set(saved.places, { fromSaved: true, savedAt: saved.at, reason: err.kind });
        return saved.places;
      }
    }
    throw err;
  }
}

// ------------------------------------------------------------------ device location

export function getCurrentPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      (error) => {
        let message = 'Unable to get your location.';
        if (error.code === error.PERMISSION_DENIED) {
          message =
            'Location access is required to find nearby services. You can enable it from your device or browser settings.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location information is unavailable. Please try again.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out. Please try again.';
        }
        reject(new Error(message));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  });
}
