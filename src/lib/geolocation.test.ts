import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getCurrentPosition } from './overpass';

type OK = (p: GeolocationPosition) => void;
type ERR = (e: GeolocationPositionError) => void;
type Call = { ok: OK; err: ERR; options: PositionOptions };

const pos = (lat: number, lon: number) => ({ coords: { latitude: lat, longitude: lon } }) as GeolocationPosition;
const geoErr = (code: number) => ({ code, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3, message: '' }) as GeolocationPositionError;

let current: Call[];
let watches: Call[];
let cleared: number[];

beforeEach(() => {
  vi.useFakeTimers();
  current = [];
  watches = [];
  cleared = [];
  vi.stubGlobal('navigator', {
    geolocation: {
      getCurrentPosition: (ok: OK, err: ERR, options: PositionOptions) => void current.push({ ok, err, options }),
      watchPosition: (ok: OK, err: ERR, options: PositionOptions) => {
        watches.push({ ok, err, options });
        return watches.length;
      },
      clearWatch: (id: number) => void cleared.push(id),
    },
  });
});
afterEach(() => vi.useRealTimers());

async function expectFailure(p: Promise<unknown>): Promise<Error> {
  try {
    await p;
  } catch (e) {
    return e as Error;
  }
  throw new Error('expected a failure');
}

describe('getting the device location', () => {
  it('returns the first fix and stops watching', async () => {
    const p = getCurrentPosition();
    current[0].ok(pos(12.97, 77.59));
    expect(await p).toEqual({ lat: 12.97, lon: 77.59 });
    expect(cleared).toContain(1);
  });

  it('first asks for a quick, low-accuracy fix that may be up to 10 minutes old', async () => {
    const p = getCurrentPosition();
    expect(current[0].options).toMatchObject({ enableHighAccuracy: false, maximumAge: 600000 });
    watches[0].ok(pos(1, 2));
    await p;
  });

  it('uses a fix from watchPosition when getCurrentPosition fails or hangs', async () => {
    const p = getCurrentPosition();
    current[0].err(geoErr(3)); // getCurrentPosition timed out
    await vi.advanceTimersByTimeAsync(3000);
    watches[0].ok(pos(13.0, 77.6)); // the watch delivers
    expect(await p).toEqual({ lat: 13.0, lon: 77.6 });
  });

  it('tries once more with high accuracy (GPS) when the quick attempt gets nothing', async () => {
    const p = getCurrentPosition();
    await vi.advanceTimersByTimeAsync(12500); // quick attempt gives up
    expect(current).toHaveLength(2);
    expect(current[1].options).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 });
    current[1].ok(pos(12.5, 77.5));
    expect(await p).toEqual({ lat: 12.5, lon: 77.5 });
  });

  it('does not retry when permission is denied, and says so at once', async () => {
    const p = expectFailure(getCurrentPosition());
    current[0].err(geoErr(1));
    const e = await p;
    expect(e.message).toContain('Location access is required');
    expect(current).toHaveLength(1);
  });

  it('gives up after both attempts, with a message that explains what to do', async () => {
    const p = expectFailure(getCurrentPosition());
    await vi.advanceTimersByTimeAsync(12500);
    await vi.advanceTimersByTimeAsync(23000);
    const e = await p;
    expect(e.message).toContain('took too long');
    expect(e.message).toContain('Location');
    expect(cleared.length).toBe(2); // both watches were stopped
  });

  it('reports unavailable location when the device says so', async () => {
    const p = expectFailure(getCurrentPosition());
    current[0].err(geoErr(2));
    await vi.advanceTimersByTimeAsync(12500);
    current[1].err(geoErr(2));
    await vi.advanceTimersByTimeAsync(23000);
    expect((await p).message).toContain('unavailable');
  });

  it('fails clearly when the browser has no geolocation', async () => {
    vi.stubGlobal('navigator', {});
    expect((await expectFailure(getCurrentPosition())).message).toContain('not supported');
  });
});
