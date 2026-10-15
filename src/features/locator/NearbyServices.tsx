import { useEffect, useState, useCallback } from 'react';
import { MapPin, Navigation, Phone, RefreshCw, AlertCircle, Clock, Filter } from 'lucide-react';
import { Badge, ErrorState, EmptyState, LoadingState } from '@/components/ui';

interface Place {
  id: string;
  name: string;
  category: string;
  distance: number;
  lat: number;
  lon: number;
  address: string;
  phone?: string;
  open?: boolean;
}

type FilterType = 'all' | 'pharmacy' | 'hospital' | 'clinic';
type ViewType = 'list' | 'map';

const RADII = [1, 3, 5, 10];

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

const overpassQuery = (lat: number, lon: number, radius: number, filter: FilterType): string => {
  const r = radius * 1000;
  const filters: Record<FilterType, string[]> = {
    all: [
      `node["amenity"="pharmacy"](around:${r},${lat},${lon})`,
      `node["amenity"="hospital"](around:${r},${lat},${lon})`,
      `node["amenity"="clinic"](around:${r},${lat},${lon})`,
      `node["shop"="chemist"](around:${r},${lat},${lon})`,
    ],
    pharmacy: [
      `node["amenity"="pharmacy"](around:${r},${lat},${lon})`,
      `node["shop"="chemist"](around:${r},${lat},${lon})`,
    ],
    hospital: [`node["amenity"="hospital"](around:${r},${lat},${lon})`],
    clinic: [`node["amenity"="clinic"](around:${r},${lat},${lon})`],
  };
  return `[out:json][timeout:15];(${filters[filter].join(';')};);out body 50;`;
};

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function NearbyServices() {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [radius, setRadius] = useState(3);
  const [view, setView] = useState<ViewType>('list');
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [showManual, setShowManual] = useState(false);

  const search = useCallback(async (lat: number, lon: number) => {
    setLoading(true);
    setError('');
    try {
      const query = overpassQuery(lat, lon, radius, filter);
      let data: any = null;
      let lastErr: Error | null = null;

      for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
          const res = await fetchWithTimeout(endpoint, {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          }, 12000);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          data = await res.json();
          break;
        } catch (err) {
          lastErr = err as Error;
        }
      }

      if (!data) throw lastErr || new Error('All search servers failed');

      const results: Place[] = (data.elements || []).map((el: any) => {
        const tags = el.tags || {};
        const distance = haversine(lat, lon, el.lat, el.lon);
        return {
          id: String(el.id),
          name: tags.name || tags['name:en'] || 'Unnamed location',
          category: tags.amenity || tags.shop || 'unknown',
          distance: Math.round(distance * 100) / 100,
          lat: el.lat,
          lon: el.lon,
          address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:city'], tags['addr:postcode']].filter(Boolean).join(' ') || 'Address not available',
          phone: tags.phone || tags['contact:phone'],
          open: tags.opening_hours ? true : undefined,
        };
      }).sort((a: Place, b: Place) => a.distance - b.distance);
      setPlaces(results);
      localStorage.setItem('femcare_cached_places', JSON.stringify(results));
    } catch (err) {
      const cached = localStorage.getItem('femcare_cached_places');
      if (cached) {
        setPlaces(JSON.parse(cached));
        setError('The nearby search is temporarily unavailable. Showing cached results — may be outdated.');
      } else {
        setError('Unable to reach the map search service. This is often temporary. Please try again in a moment, or enter your location manually.');
      }
    } finally {
      setLoading(false);
    }
  }, [radius, filter]);

  const getLocation = useCallback(() => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser. Enter your location manually.');
      setShowManual(true);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setLocation(loc);
        search(loc.lat, loc.lon);
      },
      () => {
        setLocationError('Location access is required to find nearby services. You can enable it from your device settings or enter your location manually.');
        setShowManual(true);
        setLoading(false);
      },
      { timeout: 15000, enableHighAccuracy: false, maximumAge: 60000 }
    );
  }, [search]);

  useEffect(() => {
    getLocation();
  }, [getLocation]);

  const handleManualSearch = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon)) return;
    setLocation({ lat, lon });
    search(lat, lon);
    setShowManual(false);
  };

  const handleRetry = () => {
    if (location) search(location.lat, location.lon);
    else getLocation();
  };

  const categoryLabel = (cat: string): { label: string; color: string } => {
    if (cat === 'pharmacy' || cat === 'chemist') return { label: 'Pharmacy', color: 'primary' };
    if (cat === 'hospital') return { label: 'Hospital', color: 'error' };
    if (cat === 'clinic') return { label: 'Clinic', color: 'success' };
    return { label: cat, color: 'gray' };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Nearby Services</h1>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={16} className="text-ink-muted" />
          <span className="text-sm font-medium text-ink dark:text-gray-200">Filter</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {(['all', 'pharmacy', 'hospital', 'clinic'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`chip ${filter === f ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
            >
              {f === 'all' ? 'All' : f === 'pharmacy' ? 'Pharmacies' : f === 'hospital' ? 'Hospitals' : 'Clinics'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-sm text-ink-muted dark:text-ink-muted-dark">Radius:</span>
          {RADII.map(r => (
            <button
              key={r}
              onClick={() => setRadius(r)}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${radius === r ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
            >
              {r} km
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${view === 'list' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
            List
          </button>
          <button onClick={() => setView('map')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${view === 'map' ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
            <MapPin size={14} /> Map
          </button>
          <button onClick={handleRetry} className="btn-outline text-sm ml-auto">
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      </div>

      {/* Location error */}
      {locationError && (
        <div className="card bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-900">
          <div className="flex items-start gap-2">
            <AlertCircle size={18} className="text-warning flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-ink dark:text-gray-200">{locationError}</p>
              {!showManual && (
                <button onClick={() => setShowManual(true)} className="text-sm text-primary mt-1 hover:underline">Enter location manually</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manual search */}
      {showManual && (
        <div className="card">
          <h3 className="text-sm font-medium text-ink dark:text-gray-200 mb-3">Enter your location</h3>
          <div className="flex gap-2">
            <input className="input flex-1" type="number" step="any" placeholder="Latitude" value={manualLat} onChange={e => setManualLat(e.target.value)} />
            <input className="input flex-1" type="number" step="any" placeholder="Longitude" value={manualLon} onChange={e => setManualLon(e.target.value)} />
            <button onClick={handleManualSearch} className="btn-primary">Search</button>
          </div>
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-2">Tip: Find your coordinates from Google Maps by right-clicking your location.</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && places.length > 0 && (
        <div className="card bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-900">
          <p className="text-sm text-ink dark:text-gray-200">{error}</p>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <LoadingState message="Searching nearby..." />
      ) : error && places.length === 0 ? (
        <ErrorState message={error} onRetry={handleRetry} />
      ) : view === 'map' && location ? (
        <div className="card overflow-hidden p-0">
          <iframe
            title="Nearby Map"
            className="w-full h-[400px] border-0"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${location.lon - 0.02},${location.lat - 0.02},${location.lon + 0.02},${location.lat + 0.02}&layer=mapnik&marker=${location.lat},${location.lon}`}
          />
          <div className="p-3">
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">Showing your approximate location on the map. Use the list view for details and directions.</p>
          </div>
        </div>
      ) : places.length === 0 ? (
        <EmptyState icon={<MapPin size={40} />} title="No nearby services found" message="Try increasing the search radius or changing the filter." />
      ) : (
        <>
          <div className="card bg-accent-50 dark:bg-accent-900/20 border-accent-200 dark:border-accent-900">
            <p className="text-sm text-ink dark:text-gray-200">Product availability may vary. Please confirm with the store.</p>
          </div>
          <div className="space-y-2">
            {places.map(place => {
              const cat = categoryLabel(place.category);
              return (
                <div key={place.id} className="card flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    cat.color === 'error' ? 'bg-error-50 dark:bg-error-900/30' :
                    cat.color === 'success' ? 'bg-success-50 dark:bg-success-900/30' :
                    'bg-primary-50 dark:bg-primary-900/30'
                  }`}>
                    <MapPin size={20} className={
                      cat.color === 'error' ? 'text-error' :
                      cat.color === 'success' ? 'text-success' :
                      'text-primary'
                    } />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink dark:text-gray-100">{place.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge color={cat.color as any}>{cat.label}</Badge>
                      <span className="text-xs text-ink-muted dark:text-ink-muted-dark">{place.distance} km away</span>
                    </div>
                    <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{place.address}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <a
                        href={`https://www.openstreetmap.org/directions?from=&to=${place.lat}%2C${place.lon}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <Navigation size={12} /> Directions
                      </a>
                      {place.phone && (
                        <a href={`tel:${place.phone}`} className="flex items-center gap-1 text-xs text-success hover:underline">
                          <Phone size={12} /> Call
                        </a>
                      )}
                      {place.open !== undefined && (
                        <span className="flex items-center gap-1 text-xs text-ink-muted dark:text-ink-muted-dark">
                          <Clock size={12} /> {place.open ? 'Open' : 'Unknown'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
