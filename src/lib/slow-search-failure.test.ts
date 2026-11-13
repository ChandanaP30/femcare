import { describe, it, expect } from 'vitest';
import { shouldShowFailureApology } from './slow-search';

describe('apology after a slow failed search', () => {
  it('shows after 35 seconds of searching ended in an error', () => {
    expect(shouldShowFailureApology({ failed: true, elapsedMs: 35700, hasResults: false })).toBe(true);
  });
  it('keeps the normal error message for quick failures', () => {
    expect(shouldShowFailureApology({ failed: true, elapsedMs: 9000, hasResults: false })).toBe(false);
  });
  it('does not show without an error', () => {
    expect(shouldShowFailureApology({ failed: false, elapsedMs: 40000, hasResults: false })).toBe(false);
  });
  it('never covers results', () => {
    expect(shouldShowFailureApology({ failed: true, elapsedMs: 40000, hasResults: true })).toBe(false);
  });
});