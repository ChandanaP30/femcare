import { describe, it, expect } from 'vitest';
import { PHYSICAL_SYMPTOMS, EMOTIONAL_SYMPTOMS, ALL_SYMPTOMS, MOODS, getMood, symptomCategory, generateInsights } from './symptoms';

describe('symptom and mood lists', () => {
  it('ALL_SYMPTOMS is the physical list followed by the emotional list', () => {
    expect(ALL_SYMPTOMS).toEqual([...PHYSICAL_SYMPTOMS, ...EMOTIONAL_SYMPTOMS]);
  });

  it('has no duplicate symptoms', () => {
    expect(new Set(ALL_SYMPTOMS).size).toBe(ALL_SYMPTOMS.length);
  });

  it('classifies symptoms into physical and emotional', () => {
    expect(symptomCategory(PHYSICAL_SYMPTOMS[0])).toBe('physical');
    expect(symptomCategory(EMOTIONAL_SYMPTOMS[0])).toBe('emotional');
  });

  it('returns the mood for each key', () => {
    MOODS.forEach((m) => expect(getMood(m.key)).toBeDefined());
  });
});

describe('generateInsights', () => {
  it('returns an array without throwing when there is no data', () => {
    const result = generateInsights([], [], 28, 5);
    expect(Array.isArray(result)).toBe(true);
  });

  it('returns an array when data is present', () => {
    const periods = [{ id: 'a', user_id: 'u', start_date: '2026-09-01', end_date: '2026-09-05', blood_flow: null, notes: null, created_at: '' }] as any;
    const logs = [{ id: 'l', user_id: 'u', log_date: '2026-09-02', mood: MOODS[0].key, symptoms: [PHYSICAL_SYMPTOMS[0]], pain_level: 4, notes: null }] as any;
    const result = generateInsights(periods, logs, 28, 5);
    expect(Array.isArray(result)).toBe(true);
  });
});