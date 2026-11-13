/** How long the normal loading screen is shown before the apology screen takes over. */
export const SLOW_SEARCH_SECONDS = 35;

/**
 * The apology screen is only for a live search that has no results to show yet.
 * With saved results on screen, nothing is replaced while the refresh runs behind them.
 */
export function shouldShowApology(opts: { loading: boolean; seconds: number; hasResults: boolean }): boolean {
  return opts.loading && !opts.hasResults && opts.seconds >= SLOW_SEARCH_SECONDS;
}

/**
 * A Google Maps search for pharmacies or hospitals "near me". Google works out the position from the
 * phone's own location, so it is never an old or approximate position saved by the app.
 */
export function googleMapsSearchUrl(kind: 'pharmacy' | 'hospital'): string {
  const query = kind === 'pharmacy' ? 'pharmacies near me' : 'hospitals near me';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** A search that took at least the slow-search wait and then failed, with nothing to show. */
export function shouldShowFailureApology(opts: { failed: boolean; elapsedMs: number; hasResults: boolean }): boolean {
  return opts.failed && !opts.hasResults && opts.elapsedMs >= SLOW_SEARCH_SECONDS * 1000;
}