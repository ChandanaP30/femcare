import { describe, it, expect } from 'vitest';
import { buildReportData, type ReportPeriod, type ReportLog } from './report-data';
import { buildReportHtml } from './report-html';
import { rt } from './report-i18n';

const label = (raw: string) => 'L:' + raw;
const TODAY = new Date(2026, 9, 29, 12, 0, 0);
const per = (start: string, end: string | null = null): ReportPeriod => ({ start_date: start, end_date: end });
const log = (date: string, o: Partial<ReportLog> = {}): ReportLog => ({ log_date: date, mood: null, symptoms: null, pain_level: null, notes: null, ...o });

describe('report data: cycles and periods', () => {
  it('returns empty, honest results when there is no data', () => {
    const d = buildReportData([], [], label, TODAY);
    expect(d.cycleStats).toEqual({ avg: null, min: null, max: null, n: 0 });
    expect(d.durationStats.n).toBe(0);
    expect(d.lastPeriod).toBeNull();
    expect(d.insights).toEqual([]);
    expect(d.quality.status).toBe('insufficient');
    expect(d.timeline).toEqual([]);
    expect(d.trend.enough).toBe(false);
  });

  it('computes average, range and count from regular 28-day cycles', () => {
    const d = buildReportData([per('2026-08-06', '2026-08-10'), per('2026-09-03', '2026-09-07'), per('2026-10-01', '2026-10-05'), per('2026-10-29')], [], label, TODAY);
    expect(d.cycleStats).toEqual({ avg: 28, min: 28, max: 28, n: 3 });
    expect(d.durationStats).toEqual({ avg: 5, n: 3 });
    expect(d.lastPeriod).toEqual({ start: '2026-10-29', daysAgo: 0 });
  });

  it('counts a 70-day gap as missing data, not as a cycle', () => {
    const d = buildReportData([per('2026-01-14'), per('2026-02-25'), per('2026-03-25'), per('2026-05-30')], [], label, TODAY);
    expect(d.cycleStats.n).toBe(2);
    expect(d.quality.status).toBe('review');
    expect(d.quality.key).toBe('qualityGaps');
    expect(d.quality.params).toEqual({ n: 1 });
  });

  it('flags periods without an end date', () => {
    const d = buildReportData([per('2026-08-06', '2026-08-10'), per('2026-09-03'), per('2026-10-01', '2026-10-05')], [], label, TODAY);
    expect(d.quality.key).toBe('qualityNoEnd');
    expect(d.quality.params).toEqual({ n: 1 });
  });

  it('marks quality complete only when there are no gaps or missing ends', () => {
    const d = buildReportData([per('2026-08-06', '2026-08-10'), per('2026-09-03', '2026-09-07'), per('2026-10-01', '2026-10-05')], [], label, TODAY);
    expect(d.quality).toMatchObject({ status: 'ok', key: 'qualityComplete' });
  });
});

describe('report data: symptoms, moods and pain', () => {
  it('counts each symptom once per log and uses the labeller', () => {
    const logs = [log('2026-10-01', { symptoms: ['Cramps', 'Cramps'] }), log('2026-10-02', { symptoms: ['Cramps'] })];
    const d = buildReportData([], logs, label, TODAY);
    expect(d.symptoms[0]).toEqual({ label: 'L:Cramps', count: 2 });
  });

  it('gives pain averages and counts of 7 or higher only from entries that exist', () => {
    const logs = [log('2026-10-01', { pain_level: 8 }), log('2026-10-02', { pain_level: 2 }), log('2026-10-03', { pain_level: 0 })];
    const d = buildReportData([], logs, label, TODAY);
    expect(d.pain).toEqual({ avg: 5, n: 2, high: 1, recent: [8, 2] });
  });
});

describe('report data: insights', () => {
  it('produces no insight without enough entries', () => {
    const d = buildReportData([], [log('2026-10-01', { symptoms: ['Cramps'] })], label, TODAY);
    expect(d.insights).toEqual([]);
  });

  it('states the most logged symptom only with at least 3 logs and 2 occurrences', () => {
    const logs = [1, 2, 3].map((n) => log(`2026-10-0${n}`, { symptoms: ['Headache'] }));
    const d = buildReportData([], logs, label, TODAY);
    const ins = d.insights.find((i) => i.key === 'insMost');
    expect(ins?.params).toMatchObject({ symptom: 'L:Headache', count: 3, total: 3, pct: 100 });
  });

  it('states high pain only from real entries of 7 or more', () => {
    const logs = [7, 8, 2].map((p, i) => log(`2026-10-0${i + 1}`, { pain_level: p }));
    const d = buildReportData([], logs, label, TODAY);
    expect(d.insights.some((i) => i.key === 'insPainHigh' && i.params.days === 2)).toBe(true);
  });

  it('describes cycle variation only with 3 or more cycles', () => {
    const two = buildReportData([per('2026-08-06'), per('2026-09-03'), per('2026-10-01')], [], label, TODAY);
    expect(two.insights.some((i) => i.key === 'insCycleSteady' || i.key === 'insCycleVaries')).toBe(false);
    const three = buildReportData([per('2026-07-09'), per('2026-08-06'), per('2026-09-03'), per('2026-10-01')], [], label, TODAY);
    expect(three.insights.some((i) => i.key === 'insCycleSteady')).toBe(true);
  });

  it('counts notes without quoting private text in the insight', () => {
    const d = buildReportData([], [log('2026-10-01', { notes: 'secret detail' })], label, TODAY);
    const ins = d.insights.find((i) => i.key === 'insNotes');
    expect(ins?.params).toEqual({ n: 1 });
    expect(JSON.stringify(d.insights)).not.toContain('secret detail');
  });
});

describe('report layout', () => {
  const data = buildReportData([per('2026-08-06', '2026-08-10'), per('2026-09-03', '2026-09-07'), per('2026-10-01', '2026-10-05')], [], label, TODAY);
  const opts = (lang: 'en' | 'hi' | 'kn', includeNotes = false) => ({ lang, name: 'Chandana', generated: TODAY, includeNotes, fontCss: '' });

  it('uses the chosen language for titles and the disclaimer', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const html = buildReportHtml(data, opts(lang));
      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toContain(rt(lang, 'sectionSummary'));
      expect(html).toContain(rt(lang, 'disclaimer').slice(0, 40).replace(/'/g, '&#39;'));
    }
  });

  it('does not show English section titles in Kannada or Hindi', () => {
    const kn = buildReportHtml(data, opts('kn'));
    const hi = buildReportHtml(data, opts('hi'));
    for (const english of ['Average cycle', 'Data quality', 'Recent periods', 'Insights from your records']) {
      expect(kn).not.toContain(english);
      expect(hi).not.toContain(english);
    }
  });

  it('shows private notes only when asked', () => {
    const withNote = buildReportData([per('2026-10-01')], [log('2026-10-02', { notes: 'visible only if chosen' })], label, TODAY);
    const hidden = buildReportHtml(withNote, opts('en', false));
    const shown = buildReportHtml(withNote, opts('en', true));
    expect(hidden).not.toContain('visible only if chosen');
    expect(shown).toContain('visible only if chosen');
  });

  it('escapes the name so it cannot inject markup', () => {
    const html = buildReportHtml(data, { ...opts('en'), name: '<img src=x>' });
    expect(html).toContain('&lt;img src=x&gt;');
    expect(html).not.toContain('<img src=x>');
  });
});