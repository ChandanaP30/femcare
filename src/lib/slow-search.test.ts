import { describe, it, expect } from 'vitest';
import { SLOW_SEARCH_SECONDS, shouldShowApology, googleMapsSearchUrl } from './slow-search';

describe('slow search apology', () => {
  it('waits 35 seconds', () => {
    expect(SLOW_SEARCH_SECONDS).toBe(35);
  });

  it('shows the normal loading screen before 35 seconds', () => {
    expect(shouldShowApology({ loading: true, seconds: 0, hasResults: false })).toBe(false);
    expect(shouldShowApology({ loading: true, seconds: 34, hasResults: false })).toBe(false);
  });

  it('shows the apology from 35 seconds while still loading', () => {
    expect(shouldShowApology({ loading: true, seconds: 35, hasResults: false })).toBe(true);
    expect(shouldShowApology({ loading: true, seconds: 80, hasResults: false })).toBe(true);
  });

  it('goes away as soon as the search finishes', () => {
    expect(shouldShowApology({ loading: false, seconds: 60, hasResults: false })).toBe(false);
  });

  it('never covers results that are already on screen', () => {
    expect(shouldShowApology({ loading: true, seconds: 60, hasResults: true })).toBe(false);
  });
});

describe('google maps links', () => {
  it('searches for pharmacies near the phone', () => {
    expect(googleMapsSearchUrl('pharmacy')).toBe('https://www.google.com/maps/search/?api=1&query=pharmacies%20near%20me');
  });

  it('searches for hospitals near the phone', () => {
    expect(googleMapsSearchUrl('hospital')).toBe('https://www.google.com/maps/search/?api=1&query=hospitals%20near%20me');
  });
});