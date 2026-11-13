import { describe, it, expect } from 'vitest';
import { limitContacts } from './sosNative';

const c = (id: string, name: string, phone: string) => ({ id, name, phone });

describe('limitContacts', () => {
  it('keeps order, drops duplicates and empty numbers', () => {
    const out = limitContacts([
      c('1', 'A', '+919876543210'),
      c('2', 'A again', '09876543210'),
      c('3', 'B', '+911111111111'),
      c('4', 'None', ''),
    ]);
    expect(out.map((x) => x.name)).toEqual(['A', 'B']);
  });
  it('uses at most five contacts', () => {
    const many = Array.from({ length: 9 }, (_, i) => c(String(i), `N${i}`, `+91900000000${i}`));
    expect(limitContacts(many)).toHaveLength(5);
    expect(limitContacts(many)[0].name).toBe('N0');
  });
  it('returns an empty list for no contacts', () => {
    expect(limitContacts([])).toEqual([]);
  });
});
