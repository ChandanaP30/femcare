import { describe, it, expect } from 'vitest';
import { buildReportData, type ReportPeriod, type ReportLog } from './report-data';
import { buildReportHtml } from './report-html';
import { rt, type ReportLang } from './report-i18n';

const TODAY = new Date(2026, 9, 29, 12, 0, 0);
const LOGO = 'data:image/png;base64,AAAA';
const per = (start: string, end: string | null = null): ReportPeriod => ({ start_date: start, end_date: end });
const log = (date: string, o: Partial<ReportLog> = {}): ReportLog => ({ log_date: date, mood: null, symptoms: null, pain_level: null, notes: null, ...o });
const label = (raw: string) => 'L:' + raw;

const periods = [per('2026-08-06', '2026-08-10'), per('2026-09-03', '2026-09-07'), per('2026-10-01', '2026-10-05')];
const logs = [
  log('2026-08-07', { symptoms: ['Cramps'], mood: 'good', pain_level: 6 }),
  log('2026-08-08', { symptoms: ['Cramps'], pain_level: 8 }),
];
const data = buildReportData(periods, logs, label, TODAY);

const opts = (lang: ReportLang, logoDataUri?: string) => ({
  lang,
  name: 'Test',
  generated: TODAY,
  includeNotes: false,
  fontCss: '',
  logoDataUri,
  range: { from: '2026-08-06', to: '2026-10-29' },
});

describe('consultation report layout', () => {
  it('shows the app logo in the header when it is provided', () => {
    expect(buildReportHtml(data, opts('en', LOGO))).toContain(`<img class="logo" src="${LOGO}" alt="FemCare+">`);
    expect(buildReportHtml(data, opts('en'))).not.toContain('class="logo"');
  });

  it('has no recommendations or general-advice section in any language', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const html = buildReportHtml(data, opts(lang, LOGO));
      expect(html).not.toContain(rt(lang, 'sectionRecommendations'));
      expect(html).not.toContain(rt(lang, 'recHydration'));
      expect(html).not.toContain(rt(lang, 'recTrack'));
    }
  });

  it('has a consultation summary in every language, with the reporting period', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const html = buildReportHtml(data, opts(lang, LOGO));
      expect(html).toContain(rt(lang, 'sectionConsultation'));
      expect(html).toContain(rt(lang, 'consultRange', { from: '', to: '' }).split(':')[0]);
    }
  });

  it('states the cycle facts and the records used in English', () => {
    const html = buildReportHtml(data, opts('en', LOGO));
    expect(html).toContain('Records used: 2 cycles, 2 daily logs, 3 periods');
    expect(html).toContain('Average cycle length: 28 days');
    expect(html).toContain('Average period duration: 5 days');
    expect(html).toContain('Cramps (2)');
    expect(html).toContain('Average recorded pain: 7 out of 10');
  });

  it('leaves no unfilled placeholders in any language', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const html = buildReportHtml(data, opts(lang, LOGO));
      expect(html).not.toMatch(/\{[a-zA-Z]+\}/);
    }
  });

  it('keeps the medical disclaimer at the end in every language', () => {
    for (const lang of ['en', 'hi', 'kn'] as const) {
      const html = buildReportHtml(data, opts(lang, LOGO));
      expect(html).toContain(rt(lang, 'disclaimerTitle'));
      expect(html.indexOf(rt(lang, 'disclaimerTitle'))).toBeGreaterThan(html.indexOf(rt(lang, 'sectionConsultation')));
    }
  });
});