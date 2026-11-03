import { useEffect, useState, useCallback, useRef } from 'react';
import { findNearbyPlaces, getCurrentPosition, getSearchInfo, getSavedPlaces, distanceKm, describeAttempts, NearbySearchError, FILTER_CONFIG, type NearbyErrorKind, type PlaceFilter } from '@/lib/overpass';
import type { NearbyPlace } from '@/lib/types';
import { MapPin, Navigation, Phone, RefreshCw, AlertCircle, Loader2, List, Map as MapIcon, Search } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage } from '@/lib/language-context';
import type { TranslationKey } from '@/lib/i18n';

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

export function LocatorScreen() {
  const { t } = useLanguage();
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(readLastPosition);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [loadingLoc, setLoadingLoc] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [locError, setLocError] = useState('');
  const [placesError, setPlacesError] = useState('');
  const [placesDetails, setPlacesDetails] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null); // set when saved results are shown
  const [refreshing, setRefreshing] = useState(false); // fresh search running behind saved results
  const requestId = useRef(0);
  const [radius, setRadius] = useState(3);
  const [activeFilters, setActiveFilters] = useState<PlaceFilter[]>(['pharmacy', 'sanitary']);
  const [view, setView] = useState<'list' | 'map'>('list');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  // Keep the latest t() in a ref: its identity changes whenever the language provider re-renders,
  // and listing it as a dependency would restart the search each time.
  const tRef = useRef(t);
  tRef.current = t;
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
      setManualLat(pos.lat.toFixed(4));
      setManualLon(pos.lon.toFixed(4));
    } catch (err) {
      setLocError(err instanceof Error ? err.message : 'Unable to get your location.');
    } finally {
      setLoadingLoc(false);
    }
  }, []);

  const searchPlaces = useCallback(async () => {
    if (!location) return;
    const id = ++requestId.current;
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

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('nearbyStoresTitle')}</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">{t('nearbyStoresSubtitle')}</p>
      </div>

      {/* Location status */}
      {locError && (
        <div className="card p-4 border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-error-500 shrink-0 mt-0.5 dark:text-error-300" />
            <div className="flex-1">
              <p className="text-sm text-error-700 dark:text-error-300">{locError}</p>
              <div className="mt-3 space-y-2">
                <button onClick={getLocation} className="btn-secondary text-sm flex items-center gap-2 w-fit">
                  <RefreshCw size={14} /> {t('tryAgain')}
                </button>
                <div className="flex items-end gap-2">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1 dark:text-neutral-400">{t('latitude')}</label>
                    <input type="text" value={manualLat} onChange={(e) => setManualLat(e.target.value)} placeholder="lat" className="input-field !py-2 text-sm w-28" />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1 dark:text-neutral-400">{t('longitude')}</label>
                    <input type="text" value={manualLon} onChange={(e) => setManualLon(e.target.value)} placeholder="lon" className="input-field !py-2 text-sm w-28" />
                  </div>
                  <button onClick={handleManualSearch} className="btn-primary !py-2 text-sm flex items-center gap-1">
                    <Search size={14} /> {t('search')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {location && !locError && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => toggleFilter(f)}
                className={`chip text-xs ${activeFilters.includes(f) ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
              >
                {FILTER_CONFIG[f].label}
              </button>
            ))}
          </div>

          {/* Radius */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-neutral-500 dark:text-neutral-400 shrink-0">{t('radius')}</span>
            <div className="flex gap-2">
              {RADII.map((r) => (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className={`chip text-xs ${radius === r ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
                >
                  {r} km
                </button>
              ))}
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('list')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'list' ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
            >
              <List size={16} /> {t('list')}
            </button>
            <button
              onClick={() => setView('map')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'map' ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
            >
              <MapIcon size={16} /> {t('map')}
            </button>
          </div>

          {/* Content */}
          {loadingPlaces ? (
            <div className="card p-8 flex flex-col items-center gap-3">
              <Loader2 size={24} className="text-primary-500 animate-spin" />
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('searchingNearbyServices')}</p>
            </div>
          ) : placesError ? (
            <div className="card p-6 text-center">
              <AlertCircle size={24} className="text-error-500 mx-auto mb-2 dark:text-error-300" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{placesError}</p>
              {placesDetails && (
                <pre className="text-[10px] leading-tight text-neutral-400 dark:text-neutral-500 mb-4 whitespace-pre-wrap text-left">{placesDetails}</pre>
              )}
              <button onClick={searchPlaces} className="btn-secondary text-sm flex items-center gap-2 mx-auto w-fit">
                <RefreshCw size={14} /> {t('retry')}
              </button>
            </div>
          ) : places.length === 0 ? (
            <div className="card p-6 text-center">
              <MapPin size={24} className="text-neutral-400 mx-auto mb-2" />
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{t('increaseRadius')}</p>
            </div>
          ) : view === 'list' ? (
            <div className="space-y-2">
              {savedAt && (
                <div className="card p-3 flex items-start justify-between gap-3 text-xs text-neutral-600 dark:text-neutral-400">
                  <span>{refreshing ? t('nearbyUpdating', { when: new Date(savedAt).toLocaleString() }) : t('nearbySavedResults', { when: new Date(savedAt).toLocaleString() })}</span>
                  {!refreshing && <button onClick={searchPlaces} className="shrink-0 flex items-center gap-1 text-primary-600 dark:text-primary-400">
                    <RefreshCw size={12} /> {t('retry')}
                  </button>}
                </div>
              )}
              {places.map((p) => (
                <PlaceCard key={p.id} place={p} t={t} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div ref={mapRef} className="w-full h-80 rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-700" />
              {selectedPlace && (
                <PlaceCard place={selectedPlace} t={t} />
              )}
            </div>
          )}

          <p className="text-xs text-neutral-400 dark:text-neutral-500">
            {t('availabilityMayVary')}
          </p>
        </>
      )}

      {!location && !locError && loadingLoc && (
        <div className="card p-8 flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-primary-500 animate-spin" />
          <p className="text-sm text-neutral-500 dark:text-neutral-400">{t('gettingLocation')}</p>
        </div>
      )}
    </div>
  );
}

function PlaceCard({ place, t }: { place: NearbyPlace; t: (key: TranslationKey) => string }) {
  const typeColors: Record<string, string> = {
    pharmacy: 'bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400',
    hospital: 'bg-error-100 text-error-600 dark:bg-error-900/30 dark:text-error-400',
    clinic: 'bg-success-100 text-success-600 dark:bg-success-900/30 dark:text-success-400',
    sanitary: 'bg-accent-100 text-accent-600 dark:bg-accent-900/30 dark:text-accent-400',
  };

  const typeLabels: Record<string, TranslationKey> = {
    pharmacy: 'pharmacy',
    hospital: 'hospital',
    clinic: 'clinic',
    sanitary: 'store',
  };

  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColors[place.type] || typeColors.sanitary}`}>
          <MapPin size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-neutral-900 dark:text-neutral-100 text-sm truncate">{place.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`chip text-xs ${typeColors[place.type] || typeColors.sanitary} !py-0.5 !px-2`}>{t(typeLabels[place.type] || 'store')}</span>
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{place.distance} km away</span>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">{place.address}</p>
          <div className="flex items-center gap-2 mt-3">
            <a
              href={`https://www.openstreetmap.org/directions?from=&to=${place.lat}%2C${place.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              <Navigation size={14} /> {t('directions')}
            </a>
            <a
              href={`https://www.openstreetmap.org/?mlat=${place.lat}&mlon=${place.lon}#map=18/${place.lat}/${place.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 hover:underline"
            >
              <MapIcon size={14} /> {t('viewOnMap')}
            </a>
            {place.phone && (
              <a href={`tel:${place.phone}`} className="flex items-center gap-1.5 text-xs font-medium text-success-600 dark:text-success-400 hover:underline">
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
