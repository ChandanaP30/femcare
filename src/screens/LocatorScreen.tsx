import { useEffect, useState, useCallback, useRef } from 'react';
import { findNearbyPlaces, getCurrentPosition, getSearchInfo, getSavedPlaces, distanceKm, describeAttempts, NearbySearchError, FILTER_CONFIG, type NearbyErrorKind, type PlaceFilter } from '@/lib/overpass';
import type { NearbyPlace } from '@/lib/types';
import { MapPin, Navigation, Phone, RefreshCw, AlertCircle, Loader2, List, Map as MapIcon, Search } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '@/lib/language-context';
import type { TranslationKey } from '@/lib/i18n';
import { PageHeader } from '@/components/PageHeader';
import { LocationApology } from '@/components/LocationApology';
import { shouldShowApology, shouldShowFailureApology } from '@/lib/slow-search';

const RADII = [1, 3, 5, 10];

// The last known position is kept on the phone so the search can start (and saved results can show)
// before the GPS fix arrives. A fresh GPS position replaces it if you have moved more than 300 m.
const LAST_POS_KEY = 'femcare_last_position_v1';
const LAST_POS_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function readLastPosition(): { lat: number; lon: number } | null {
  try {
    const raw = localStorage.getItem(LAST_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { lat?: number; lon?: number; at?: number };
    if (typeof p.lat !== 'number' || typeof p.lon !== 'number' || typeof p.at !== 'number') return null;
    return Date.now() - p.at < LAST_POS_MAX_AGE_MS ? { lat: p.lat, lon: p.lon } : null;
  } catch {
    return null;
  }
}

function writeLastPosition(pos: { lat: number; lon: number }) {
  try {
    localStorage.setItem(LAST_POS_KEY, JSON.stringify({ ...pos, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

// Each kind of failure gets its own message, so an API problem is never shown as "no results".
const NEARBY_ERROR_KEYS: Record<NearbyErrorKind, TranslationKey> = {
  offline: 'locatorOffline',
  network: 'nearbyErrNetwork',
  timeout: 'nearbyErrTimeout',
  'rate-limited': 'nearbyErrRate',
  rejected: 'nearbyErrRejected',
  server: 'nearbyErrServer',
  'bad-request': 'nearbyErrInvalid',
  'invalid-response': 'nearbyErrInvalid',
  'invalid-input': 'nearbyErrCoords',
};

const FILTERS: PlaceFilter[] = ['pharmacy', 'hospital', 'clinic', 'sanitary'];

const PRESET_KEY = 'femcare_locator_preset';
const DEFAULT_FILTERS: PlaceFilter[] = ['pharmacy', 'sanitary'];

// The SOS cards save which filters to start with; read them once when the screen opens.
function readPreset(): PlaceFilter[] {
  try {
    const raw = sessionStorage.getItem(PRESET_KEY);
    if (!raw) return DEFAULT_FILTERS;
    const list = (JSON.parse(raw) as string[]).filter((x): x is PlaceFilter => (FILTERS as string[]).includes(x));
    return list.length ? list : DEFAULT_FILTERS;
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function LocatorScreen() {
  const { t } = useLanguage();
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(readLastPosition);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [locSeconds, setLocSeconds] = useState(0); // how long the location request has been running
  const [searchSeconds, setSearchSeconds] = useState(0); // how long the places search has been running
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [locError, setLocError] = useState('');
  const [placesError, setPlacesError] = useState('');
  const [placesDetails, setPlacesDetails] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null); // set when saved results are shown
  const [refreshing, setRefreshing] = useState(false); // fresh search running behind saved results
  const requestId = useRef(0);
  const searchStartedAt = useRef<number | null>(null);
  const [slowFailed, setSlowFailed] = useState(false);
  const [radius, setRadius] = useState(3);
  const [activeFilters, setActiveFilters] = useState<PlaceFilter[]>(readPreset);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);

  // Keep the latest t() in a ref: its identity changes whenever the language provider re-renders,
  // and listing it as a dependency would restart the search each time.
  const tRef = useRef(t);
  tRef.current = t;

  // Clear the preset after opening so the next visit starts from the default.
  useEffect(() => {
    try { sessionStorage.removeItem(PRESET_KEY); } catch { /* ignore */ }
  }, []);

  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const getLocation = useCallback(async () => {
    setLocError('');
    setLoadingLoc(true);
    try {
      const pos = await getCurrentPosition();
      writeLastPosition(pos);
      setLocation((prev) => (prev && distanceKm(prev.lat, prev.lon, pos.lat, pos.lon) < 0.3 ? prev : pos));
      setLocError(''); // also clears the 'slow' notice if the fix arrives late
      setManualLat(pos.lat.toFixed(4));
      setManualLon(pos.lon.toFixed(4));
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Unable to get your location.');
    } finally {
      setLoadingLoc(false);
    }
  }, []);

  // Count the seconds while waiting for the location, so a slow fix is visible and can be bypassed.
  useEffect(() => {
    if (!loadingLoc) {
      setLocSeconds(0);
      return;
    }
    const timer = setInterval(() => setLocSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loadingLoc]);

  useEffect(() => {
    if (!loadingPlaces) {
      setSearchSeconds(0);
      return;
    }
    const timer = setInterval(() => setSearchSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [loadingPlaces]);

  useEffect(() => {
    if (loadingPlaces) {
      if (searchStartedAt.current === null) searchStartedAt.current = Date.now();
      setSlowFailed(false);
      return;
    }
    const started = searchStartedAt.current;
    searchStartedAt.current = null;
    if (started !== null) {
      setSlowFailed(shouldShowFailureApology({ failed: !!placesError, elapsedMs: Date.now() - started, hasResults: places.length > 0 }));
    } else if (!placesError) {
      setSlowFailed(false);
    }
  }, [loadingPlaces, placesError, places.length]);

  const searchPlaces = useCallback(async () => {
    if (!location) return;
    const id = ++requestId.current;
    setSearchSeconds(0);
    setPlacesError('');
    setPlacesDetails('');

    // Saved earlier answers are shown at once while a fresh search runs behind them.
    const saved = getSavedPlaces(location.lat, location.lon, radius, activeFilters);
    if (saved) {
      setPlaces(saved.places);
      setSavedAt(saved.at);
      setRefreshing(true);
      setLoadingPlaces(false);
    } else {
      setSavedAt(null);
      setPlaces([]);
      setLoadingPlaces(true);
    }

    try {
      const results = await findNearbyPlaces(location.lat, location.lon, radius, activeFilters);
      if (id !== requestId.current) return; // a newer search has started
      setPlaces(results);
      setSavedAt(getSearchInfo(results).savedAt);
    } catch (err) {
      if (id !== requestId.current) return;
      if (saved) return; // keep showing the saved results; the notice stays visible
      if (err instanceof NearbySearchError) {
        setPlacesError(tRef.current(NEARBY_ERROR_KEYS[err.kind]));
        setPlacesDetails(describeAttempts(err.attempts));
      } else {
        setPlacesError(tRef.current('nearbyErrServer'));
        setPlacesDetails(err instanceof Error ? err.message : '');
      }
    } finally {
      if (id === requestId.current) {
        setLoadingPlaces(false);
        setRefreshing(false);
      }
    }
  }, [location, radius, activeFilters]);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  useEffect(() => {
    if (location && activeFilters.length > 0) {
      searchPlaces();
    }
  }, [location, radius, activeFilters, searchPlaces]);

  // Initialize map when in map view
  useEffect(() => {
    if (view !== 'map' || !mapRef.current || !location) return;

    if (!mapInstance.current) {
      mapInstance.current = L.map(mapRef.current).setView([location.lat, location.lon], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstance.current);
    } else {
      mapInstance.current.setView([location.lat, location.lon], 14);
    }

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // User location marker
    const userIcon = L.divIcon({
      html: '<div style="width:16px;height:16px;background:#9d86c4;border-radius:50%;border:3px solid white;box-shadow:0 0 8px rgba(157,134,196,0.5);"></div>',
      className: '',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
    });
    const userMarker = L.marker([location.lat, location.lon], { icon: userIcon }).addTo(mapInstance.current);
    userMarker.bindPopup(t('yourLocation'));
    markersRef.current.push(userMarker);

    // Place markers
    places.forEach((p) => {
      const color = getMarkerColor(p.type);
      const icon = L.divIcon({
        html: `<div style="width:24px;height:24px;background:${color};border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);"></div>`,
        className: '',
        iconSize: [24, 24],
        iconAnchor: [12, 24],
      });
      const marker = L.marker([p.lat, p.lon], { icon }).addTo(mapInstance.current!);
      marker.bindPopup(`<strong>${p.name}</strong><br/>${p.address}<br/>${p.distance} km away`);
      marker.on('click', () => setSelectedPlace(p));
      markersRef.current.push(marker);
    });

    // Fix map size after render
    setTimeout(() => mapInstance.current?.invalidateSize(), 100);
  }, [view, location, places]);

  function toggleFilter(f: PlaceFilter) {
    setActiveFilters((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  }

  function handleManualSearch() {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
      setLocError(''); // results are only shown when there is no location error
      setLocation({ lat, lon });
    } else {
      setLocError(t('nearbyErrCoords'));
    }
  }

  const chipOff = 'bg-bg-card text-ink-muted ring-1 ring-primary-100 dark:ring-white/15';
  const chipOn = 'bg-primary-500 text-ink-onlight';

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title={t('nearbyStoresTitle')} subtitle={t('nearbyStoresSubtitle')} art="sprig" />

      {/* Location status */}
      {locError && (
        <section className="rounded-2xl border border-error-200 bg-error-50 p-4 dark:border-white/10 dark:bg-error-600/20">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-error-600 dark:text-error-300" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-error-600 dark:text-error-200">{locError}</p>
              <div className="mt-3 space-y-3">
                <button onClick={getLocation} className="btn-secondary flex w-fit items-center gap-2 text-sm">
                  <RefreshCw size={14} /> {t('tryAgain')}
                </button>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">{t('latitude')}</label>
                    <input type="text" value={manualLat} onChange={(e) => setManualLat(e.target.value)} placeholder="lat" className="input-field w-28 !py-2 text-sm" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-ink-muted">{t('longitude')}</label>
                    <input type="text" value={manualLon} onChange={(e) => setManualLon(e.target.value)} placeholder="lon" className="input-field w-28 !py-2 text-sm" />
                  </div>
                  <button onClick={handleManualSearch} className="btn-primary flex items-center gap-1 !py-2 text-sm">
                    <Search size={14} /> {t('search')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {location && !locError && (
        <>
          {/* Controls */}
          <section className="card space-y-4 p-4">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f}
                  onClick={() => toggleFilter(f)}
                  aria-pressed={activeFilters.includes(f)}
                  className={`chip text-xs ${activeFilters.includes(f) ? chipOn : chipOff}`}
                >
                  {FILTER_CONFIG[f].label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-ink-muted">{t('radius')}</span>
                <div className="flex gap-1.5">
                  {RADII.map((r) => (
                    <button
                      key={r}
                      onClick={() => setRadius(r)}
                      aria-pressed={radius === r}
                      className={`chip text-xs ${radius === r ? chipOn : chipOff}`}
                    >
                      {r} km
                    </button>
                  ))}
                </div>
              </div>

              <div className="inline-flex rounded-full bg-primary-100 p-1 dark:bg-white/10">
                <button
                  onClick={() => setView('list')}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${view === 'list' ? 'bg-bg-card text-ink shadow-soft' : 'text-ink-muted'}`}
                >
                  <List size={16} /> {t('list')}
                </button>
                <button
                  onClick={() => setView('map')}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${view === 'map' ? 'bg-bg-card text-ink shadow-soft' : 'text-ink-muted'}`}
                >
                  <MapIcon size={16} /> {t('map')}
                </button>
              </div>
            </div>
          </section>

          {/* Content */}
          {shouldShowApology({ loading: loadingPlaces, seconds: searchSeconds, hasResults: places.length > 0 }) || (slowFailed && !!placesError && places.length === 0) ? (
            <LocationApology
              seconds={searchSeconds}
              failed={slowFailed && !loadingPlaces}
              onRetry={searchPlaces}
            />
          ) : loadingPlaces ? (
            <div className="card flex flex-col items-center gap-3 p-8">
              <Loader2 size={24} className="animate-spin text-primary-500" />
              <p className="text-sm text-ink-muted">
                {t('searchingNearbyServices')} {searchSeconds > 0 ? `${searchSeconds}s` : ''}
              </p>
            </div>
          ) : placesError ? (
            <div className="card p-6 text-center">
              <AlertCircle size={24} className="mx-auto mb-2 text-error-500" />
              <p className="mb-4 text-sm text-ink-muted">{placesError}</p>
              {placesDetails && (
                <pre className="mb-4 whitespace-pre-wrap text-left text-[10px] leading-tight text-ink-muted/80">{placesDetails}</pre>
              )}
              <button onClick={searchPlaces} className="btn-secondary mx-auto flex w-fit items-center gap-2 text-sm">
                <RefreshCw size={14} /> {t('retry')}
              </button>
            </div>
          ) : places.length === 0 ? (
            <div className="card p-6 text-center">
              <MapPin size={24} className="mx-auto mb-2 text-ink-muted" />
              <p className="text-sm text-ink-muted">{t('increaseRadius')}</p>
            </div>
          ) : view === 'list' ? (
            <div className="space-y-3">
              {savedAt && (
                <div className="card-soft flex items-start justify-between gap-3 p-3 text-xs text-ink-muted">
                  <span>{refreshing ? t('nearbyUpdating', { when: new Date(savedAt).toLocaleString() }) : t('nearbySavedResults', { when: new Date(savedAt).toLocaleString() })}</span>
                  {!refreshing && (
                    <button onClick={searchPlaces} className="flex shrink-0 items-center gap-1 text-primary-700 dark:text-primary-300">
                      <RefreshCw size={12} /> {t('retry')}
                    </button>
                  )}
                </div>
              )}
              {places.map((p) => (
                <PlaceCard key={p.id} place={p} t={t} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div ref={mapRef} className="h-80 w-full overflow-hidden rounded-2xl border border-primary-100 dark:border-white/10" />
              {selectedPlace && (
                <PlaceCard place={selectedPlace} t={t} />
              )}
            </div>
          )}

          <p className="text-xs text-ink-muted">
            {t('availabilityMayVary')}
          </p>
        </>
      )}

      {!location && !locError && loadingLoc && (
        <div className="card flex flex-col items-center gap-3 p-8">
          <Loader2 size={24} className="animate-spin text-primary-500" />
          <p className="text-sm text-ink-muted">
            {t('gettingLocation')} {locSeconds > 0 ? `${locSeconds}s` : ''}
          </p>
          {locSeconds >= 12 && (
            <>
              <p className="text-center text-xs text-ink-muted">{t('locationSlowHint')}</p>
              <button onClick={() => setLocError(t('locationSlowTitle'))} className="text-xs text-primary-700 underline dark:text-primary-300">
                {t('locationEnterManually')}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PlaceCard({ place, t }: { place: NearbyPlace; t: (key: TranslationKey) => string }) {
  const typeColors: Record<string, string> = {
    pharmacy: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300',
    hospital: 'bg-error-100 text-error-600 dark:bg-error-600/30 dark:text-error-300',
    clinic: 'bg-success-200 text-success-700 dark:bg-success-700/30 dark:text-success-300',
    sanitary: 'bg-accent-300 text-ink-onlight dark:bg-accent-600/30 dark:text-accent-300',
  };

  const typeLabels: Record<string, TranslationKey> = {
    pharmacy: 'pharmacy',
    hospital: 'hospital',
    clinic: 'clinic',
    sanitary: 'store',
  };

  const tone = typeColors[place.type] || typeColors.sanitary;
  const action = 'inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-1.5 text-xs font-medium text-primary-800 transition-colors hover:bg-primary-200 dark:bg-primary-900/50 dark:text-primary-200 dark:hover:bg-primary-900/70';

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
          <MapPin size={20} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-ink">{place.name}</h3>
          <div className="mt-1 flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>{t(typeLabels[place.type] || 'store')}</span>
            <span className="text-xs text-ink-muted">{place.distance} km away</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{place.address}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={`https://www.openstreetmap.org/directions?from=&to=${place.lat}%2C${place.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className={action}
            >
              <Navigation size={14} /> {t('directions')}
            </a>
            <a
              href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=18/${place.lat}/${place.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className={action}
            >
              <MapIcon size={14} /> {t('viewOnMap')}
            </a>
            {place.phone && (
              <a
                href={`tel:${place.phone}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-success-200 px-3 py-1.5 text-xs font-medium text-success-700 transition-colors hover:bg-success-300 dark:bg-success-700/30 dark:text-success-300"
              >
                <Phone size={14} /> {t('call')}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getMarkerColor(type: string): string {
  switch (type) {
    case 'pharmacy': return '#7d64a6';
    case 'hospital': return '#b56f76';
    case 'clinic': return '#6b8b6f';
    default: return '#c09566';
  }
}