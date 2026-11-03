import { describe, it, expect } from 'vitest';
import { COUNTRIES, LEAVE_POLICIES, getLocalizedField, getUIString, generateLeaveRequestMessage } from './leave-policies';

describe('localisation', () => {
  it('returns the field for the chosen language', () => {
    const f = { en: 'Leave', hi: 'छुट्टी', kn: 'ರಜೆ' };
    expect(getLocalizedField(f, 'en')).toBe('Leave');
    expect(getLocalizedField(f, 'hi')).toBe('छुट्टी');
    expect(getLocalizedField(f, 'kn')).toBe('ರಜೆ');
  });

  it('has a non-empty UI string in every language', () => {
    (['en', 'hi', 'kn'] as const).forEach((lang) => {
      expect(getUIString('leaveGuide' as any, lang)).toBeTruthy();
    });
  });
});

describe('policy data', () => {
  it('has at least one country and one policy', () => {
    expect(COUNTRIES.length).toBeGreaterThan(0);
    expect(LEAVE_POLICIES.length).toBeGreaterThan(0);
  });
});

describe('leave request message', () => {
  it('includes the name and the predicted date range when provided', () => {
    const msg = generateLeaveRequestMessage('Ankita', { start: '2026-11-09', end: '2026-11-13' }, 2, 'Menstrual leave', 'en');
    expect(msg).toContain('Ankita');
    expect(typeof msg).toBe('string');
    expect(msg.length).toBeGreaterThan(20);
  });

  it('still produces a message when no predicted dates are given', () => {
    const msg = generateLeaveRequestMessage('Ankita', null, null, 'Menstrual leave', 'en');
    expect(msg).toContain('Ankita');
  });
});