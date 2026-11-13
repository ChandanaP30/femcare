import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/PageHeader';
import { getLangCode } from '@/lib/lang-store';
import { translateSymptom } from '@/lib/symptom-labels';
import { REPORT_LANG_OPTIONS, reportLangFromCode, rt, type ReportLang } from '@/lib/report-i18n';
import { buildReportData, type ReportLog, type ReportPeriod } from '@/lib/report-data';
import { buildReportHtml } from '@/lib/report-html';
import { reportFontCss } from '@/lib/report-fonts';
import { exportReport, type PdfChrome } from '@/lib/save-report';
import { Download, Lock } from 'lucide-react';

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function HealthReportScreen() {
  const { user, profile } = useAuth();
  const [periods, setPeriods] = useState<ReportPeriod[]>([]);
  const [logs, setLogs] = useState<ReportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [lang, setLang] = useState<ReportLang>(() => reportLangFromCode(getLangCode()));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [logo, setLogo] = useState<string | undefined>();

  useEffect(() => {
    if (!user) return;
    let active = true;
    Promise.all([
      supabase.from('periods').select('start_date, end_date').eq('user_id', user.id).order('start_date', { ascending: true }),
      supabase.from('daily_logs').select('log_date, mood, symptoms, pain_level, notes').eq('user_id', user.id).order('log_date', { ascending: true }),
    ]).then(([p, l]) => {
      if (!active) return;
      setPeriods((p.data as ReportPeriod[]) || []);
      setLogs((l.data as ReportLog[]) || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [user]);

  // The app's own logo file, embedded so the PDF can show it.
  useEffect(() => {
    let active = true;
    fetch(`${import.meta.env.BASE_URL}app-icon.png`)
      .then((r) => (r.ok ? r.blob() : Promise.reject(new Error('logo not found'))))
      .then(blobToDataUri)
      .then((uri) => { if (active) setLogo(uri); })
      .catch(() => { /* the report still works without the logo */ });
    return () => { active = false; };
  }, []);

  const data = useMemo(
    () => buildReportData(
      periods,
      logs,
      (raw) => (raw === 'okay' ? rt(lang, 'moodOkay') : translateSymptom(raw, lang)),
      new Date(),
    ),
    [periods, logs, lang],
  );

  const range = useMemo(() => {
    const dates = [
      ...periods.flatMap((p) => [p.start_date, p.end_date ?? p.start_date]),
      ...logs.map((l) => l.log_date),
    ].filter(Boolean).map((d) => d.slice(0, 10)).sort();
    return dates.length ? { from: dates[0], to: dates[dates.length - 1] } : undefined;
  }, [periods, logs]);

  const hasData = periods.length > 0 || logs.length > 0;

  async function run(mode: 'download' | 'print') {
    setBusy(true);
    setMessage('');
    try {
      const fontCss = await reportFontCss();
      const html = buildReportHtml(data, {
        lang,
        name: profile?.name || rt(lang, 'noNameProvided'),
        generated: new Date(),
        includeNotes,
        fontCss,
        logoDataUri: logo,
        range,
      });
      const chrome: PdfChrome = {
        title: rt(lang, 'footerApp'),
        page: (n, total) => rt(lang, 'footerPage', { n, total }),
      };
      const ok = await exportReport(html, mode, chrome);
      if (!ok) setMessage(rt(lang, 'reportSaveFailed'));
    } catch {
      setMessage(rt(lang, 'reportSaveFailed'));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      <PageHeader title={rt(lang, 'reportTitle')} subtitle={rt(lang, 'brandKicker')} art="leaves" />

      {!hasData ? (
        <div className="card p-6 text-center text-sm leading-relaxed text-ink-muted">{rt(lang, 'reportEmpty')}</div>
      ) : (
        <section className="card space-y-4 p-5">
          <div>
            <p className="mb-2 text-xs font-medium text-ink-muted">{rt(lang, 'langLabel')}</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label={rt(lang, 'langLabel')}>
              {REPORT_LANG_OPTIONS.map((o) => (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => setLang(o.code)}
                  aria-pressed={lang === o.code}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    lang === o.code ? 'bg-primary-500 text-ink' : 'bg-primary-50 text-ink-muted'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIncludeNotes((v) => !v)}
            aria-pressed={includeNotes}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-bg-card p-3 text-left ring-1 ring-primary-100"
          >
            <span className="flex items-center gap-2.5 text-sm text-ink">
              <Lock size={16} strokeWidth={1.75} />
              {rt(lang, 'reportIncludeNotes')}
            </span>
            <span className={`flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${includeNotes ? 'bg-primary-500' : 'bg-primary-100'}`}>
              <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${includeNotes ? 'translate-x-5' : ''}`} />
            </span>
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => run('download')}
            className="btn-primary flex w-full items-center justify-center gap-2"
          >
            <Download size={18} strokeWidth={1.75} />
            {busy ? rt(lang, 'reportBuilding') : rt(lang, 'reportSavePdf')}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => run('print')}
            className="w-full rounded-xl bg-primary-100 px-5 py-3 text-sm font-medium text-ink transition-colors hover:bg-primary-200 disabled:opacity-50"
          >
            {rt(lang, 'reportDownload')}
          </button>

          {message && <p className="text-xs text-error-600">{message}</p>}
        </section>
      )}
    </div>
  );
}