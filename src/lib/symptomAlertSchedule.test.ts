import { describe, it, expect } from 'vitest';
import { pickNotificationTime } from './symptomAlertSchedule';

const never = () => false;
const quiet22to7 = (h: number) => h >= 22 || h < 7;
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min);

describe('pickNotificationTime', () => {
  it('waits for the next morning when the morning slot has passed', () => {
    const r = pickNotificationTime(at(2026, 5, 10, 10, 0), at(2026, 5, 13), never)!;
    expect(r.getDate()).toBe(11);
    expect(r.getHours()).toBe(9);
  });
  it('uses this morning when it is at least an hour away', () => {
    const r = pickNotificationTime(at(2026, 5, 10, 7, 30), at(2026, 5, 13), never)!;
    expect(r.getDate()).toBe(10);
    expect(r.getHours()).toBe(9);
  });
  it('never fires immediately: a slot under an hour away moves to tomorrow', () => {
    const r = pickNotificationTime(at(2026, 5, 10, 8, 30), at(2026, 5, 13), never)!;
    expect(r.getDate()).toBe(11);
  });
  it('skips quiet hours', () => {
    const r = pickNotificationTime(at(2026, 5, 10, 10, 0), at(2026, 5, 13), (h) => h >= 8 && h < 12)!;
    expect(r.getDate()).toBe(11);
    expect(r.getHours()).toBe(12);
  });
  it('returns null when quiet hours never end', () => {
    expect(pickNotificationTime(at(2026, 5, 10, 10, 0), at(2026, 5, 13), () => true)).toBeNull();
  });
  it('returns null if the slot would be after the expected period day', () => {
    expect(pickNotificationTime(at(2026, 5, 10, 10, 0), at(2026, 5, 10), quiet22to7)).toBeNull();
  });
  it('still works when the period is expected tomorrow', () => {
    const r = pickNotificationTime(at(2026, 5, 10, 10, 0), at(2026, 5, 11), quiet22to7)!;
    expect(r.getDate()).toBe(11);
  });
});
