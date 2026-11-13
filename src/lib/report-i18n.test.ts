import { describe, it, expect } from 'vitest';
import { rt, reportLangFromCode, REPORT_LANG_OPTIONS, type ReportLang, type ReportKey } from './report-i18n';

const LANGS: ReportLang[] = ['en', 'hi', 'kn'];
const KEYS: ReportKey[] = [
  'reportTitle','brandKicker','preparedFor','generated','noNameProvided','sectionSummary','cardAvgCycle','cardAvgPeriod',
  'cardCycleRange','cardLastPeriod','cardCyclesCounted','unitDays','unitDay','notEnoughData','basedOnCycles','basedOnLogs',
  'lastPeriodToday','lastPeriodDaysAgo','noPeriodsYet','sectionQuality','qualityLooksComplete','qualityNeedsReview',
  'qualityMinPeriods','qualityGaps','qualityNoEnd','qualityComplete','sectionTimeline','timelineStart','timelineEnd',
  'timelineDuration','timelineNoEnd','timelineDays','sectionSymptoms','symptomsTitle','moodTitle','painTitle','painAverage',
  'painRecent','logsCount','noSymptoms','noMoods','noPain','sectionTrend','trendNotEnough','trendCycle','sectionInsights',
  'insightsNote','insightNotEnough','insMost','insPainHigh','insPainLow','insCycleSteady','insCycleVaries','insPeriodMatch',
  'insMoodTop','insNotes','sectionRecommendations','recHydration','recDoctor','recTrack','sectionNotes','disclaimerTitle',
  'disclaimer','footerApp','footerPage','estimatedLabel','recordedLabel','langLabel','symptomsChartLegend','moodChartLegend',
  'painChartLegend', 'moodOkay',
];
const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) || []).sort().join(',');
const DEVANAGARI = /[\u0900-\u097F]/;
const KANNADA = /[\u0C80-\u0CFF]/;

describe('report text', () => {
  it('has a non-empty value for every key in every language', () => {
    for (const lang of LANGS) for (const key of KEYS) {
      expect(rt(lang, key).trim().length, `${lang}.${key}`).toBeGreaterThan(0);
    }
  });

  it('uses the same placeholders in every language', () => {
    for (const key of KEYS) {
      const en = placeholders(rt('en', key));
      expect(placeholders(rt('hi', key)), `hi.${key}`).toBe(en);
      expect(placeholders(rt('kn', key)), `kn.${key}`).toBe(en);
    }
  });

  it('English has no Hindi or Kannada script', () => {
    for (const key of KEYS) {
      expect(DEVANAGARI.test(rt('en', key)), `en.${key}`).toBe(false);
      expect(KANNADA.test(rt('en', key)), `en.${key}`).toBe(false);
    }
  });

  it('Hindi text uses Devanagari and Kannada text uses Kannada script', () => {
    for (const key of KEYS) {
      expect(DEVANAGARI.test(rt('hi', key)), `hi.${key} should contain Devanagari`).toBe(true);
      expect(KANNADA.test(rt('kn', key)), `kn.${key} should contain Kannada`).toBe(true);
    }
  });

  it('fills placeholders with values', () => {
    expect(rt('en', 'trendCycle', { n: 3 })).toBe('Cycle 3');
    expect(rt('kn', 'insMost', { total: 10, count: 4, symptom: 'ತಲೆನೋವು', pct: 40 })).toContain('4');
  });

  it('maps language codes safely, defaulting to English', () => {
    expect(reportLangFromCode('hi-IN')).toBe('hi');
    expect(reportLangFromCode('kn')).toBe('kn');
    expect(reportLangFromCode('fr')).toBe('en');
  });

  it('offers the three languages with their own names', () => {
    expect(REPORT_LANG_OPTIONS.map((o) => o.code)).toEqual(['en', 'hi', 'kn']);
  });
});