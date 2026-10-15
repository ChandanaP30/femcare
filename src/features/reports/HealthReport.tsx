import { useEffect, useState, useRef } from 'react';
import { FileText, Download, Share2, Eye, Calendar, Activity, Heart } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCycleData } from '@/lib/use-cycle-data';
import { getCycleLengths, getPeriodDurations, getAverageCycleLength, getAveragePeriodDuration, parseDate, formatDate } from '@/lib/cycle';
import { LoadingState, EmptyState } from '@/components/ui';

export default function HealthReport() {
  const { user, profile } = useAuth();
  const { periods, symptoms, loading } = useCycleData(user?.id);
  const [showPreview, setShowPreview] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  if (loading) return <LoadingState />;

  const avgCycle = getAverageCycleLength(periods, profile?.cycle_length || 28);
  const avgPeriod = getAveragePeriodDuration(periods, profile?.period_duration || 5);
  const cycleLengths = getCycleLengths(periods);
  const periodDurations = getPeriodDurations(periods);

  const symptomFreq = new Map<string, number>();
  symptoms.forEach(s => (s.symptoms || []).forEach(sym => symptomFreq.set(sym, (symptomFreq.get(sym) || 0) + 1)));
  const topSymptoms = [...symptomFreq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const painEntries = symptoms.filter(s => s.pain > 0);
  const avgPain = painEntries.length ? (painEntries.reduce((a, s) => a + s.pain, 0) / painEntries.length).toFixed(1) : null;

  const moodFreq = new Map<string, number>();
  symptoms.forEach(s => { if (s.mood) moodFreq.set(s.mood, (moodFreq.get(s.mood) || 0) + 1); });
  const topMoods = [...moodFreq.entries()].sort((a, b) => b[1] - a[1]);

  const recentPeriods = [...periods].reverse().slice(0, 6);
  const reportDate = new Date().toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });

  const hasData = periods.length > 0 || symptoms.length > 0;

  const generatePDF = () => {
    if (!reportRef.current) return;
    const reportHTML = reportRef.current.innerHTML;
    const fullHTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>FemCare+ Health Report</title>
    <style>
      body { font-family: 'Inter', Arial, sans-serif; max-width: 700px; margin: 40px auto; padding: 20px; color: #252129; }
      h1 { color: #8E5AA8; font-size: 24px; margin-bottom: 4px; }
      h2 { color: #8E5AA8; font-size: 16px; margin-top: 24px; margin-bottom: 8px; border-bottom: 1px solid #E9DDF0; padding-bottom: 4px; }
      .header { text-align: center; margin-bottom: 30px; }
      .meta { color: #6b6573; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      td { padding: 4px 8px; font-size: 13px; }
      .stat { display: inline-block; margin-right: 20px; }
      .stat-value { font-size: 20px; font-weight: bold; color: #8E5AA8; }
      .stat-label { font-size: 12px; color: #6b6573; }
      .disclaimer { margin-top: 30px; padding: 12px; background: #fdf8f0; border-radius: 8px; font-size: 12px; color: #6b6573; }
      .section { margin-bottom: 16px; }
    </style></head><body>${reportHTML}</body></html>`;

    const blob = new Blob([fullHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `FemCare-Health-Report-${formatDate(new Date())}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'FemCare+ Health Report', text: 'My health report from FemCare+', url: window.location.href });
      } catch {}
    } else {
      generatePDF();
    }
  };

  if (!hasData) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Health Report</h1>
        <EmptyState icon={<FileText size={40} />} title="No data for a report yet" message="Log periods and symptoms to generate a health report you can share with your doctor." />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Health Report</h1>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setShowPreview(!showPreview)} className="btn-outline">
          <Eye size={18} /> {showPreview ? 'Hide Preview' : 'Preview'}
        </button>
        <button onClick={generatePDF} className="btn-primary">
          <Download size={18} /> Generate PDF
        </button>
        <button onClick={handleShare} className="btn-secondary">
          <Share2 size={18} /> Share
        </button>
      </div>

      {/* Report content */}
      <div ref={reportRef} className="card bg-white dark:bg-bg-card-dark">
        <div className="header text-center mb-6">
          <h1 className="text-xl font-bold text-primary">FemCare+ Health Report</h1>
          <p className="meta text-sm text-ink-muted dark:text-ink-muted-dark">{reportDate}</p>
        </div>

        <div className="section">
          <p className="text-sm text-ink dark:text-gray-200"><strong>Name:</strong> {profile?.name || 'N/A'}</p>
          <p className="text-sm text-ink dark:text-gray-200"><strong>Email:</strong> {profile?.email || 'N/A'}</p>
        </div>

        <h2 className="text-base font-semibold text-primary border-b border-secondary pb-1 mt-6 mb-3">Cycle Summary</h2>
        <div className="section">
          <div className="stat inline-block mr-6 mb-3">
            <div className="stat-value text-xl font-bold text-primary">{avgCycle}</div>
            <div className="stat-label text-xs text-ink-muted dark:text-ink-muted-dark">Avg cycle (days)</div>
          </div>
          <div className="stat inline-block mr-6 mb-3">
            <div className="stat-value text-xl font-bold text-primary">{avgPeriod}</div>
            <div className="stat-label text-xs text-ink-muted dark:text-ink-muted-dark">Avg period (days)</div>
          </div>
          {cycleLengths.length >= 2 && (
            <div className="stat inline-block mb-3">
              <div className="stat-value text-xl font-bold text-primary">{Math.min(...cycleLengths)}–{Math.max(...cycleLengths)}</div>
              <div className="stat-label text-xs text-ink-muted dark:text-ink-muted-dark">Recent range (days)</div>
            </div>
          )}
        </div>

        <h2 className="text-base font-semibold text-primary border-b border-secondary pb-1 mt-6 mb-3">Recent Period History</h2>
        <div className="section">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-ink-muted dark:text-ink-muted-dark text-xs">
                <td className="pb-1">Start</td><td className="pb-1">End</td><td className="pb-1">Duration</td>
              </tr>
            </thead>
            <tbody>
              {recentPeriods.map(p => (
                <tr key={p.id} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="py-1.5 text-ink dark:text-gray-200">{new Date(p.start_date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="py-1.5 text-ink dark:text-gray-200">{p.end_date ? new Date(p.end_date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' }) : 'In progress'}</td>
                  <td className="py-1.5 text-ink dark:text-gray-200">{p.duration ? `${p.duration} days` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {topSymptoms.length > 0 && (
          <>
            <h2 className="text-base font-semibold text-primary border-b border-secondary pb-1 mt-6 mb-3">Most Common Symptoms</h2>
            <div className="section">
              {topSymptoms.map(([sym, count]) => (
                <div key={sym} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-ink dark:text-gray-200">{sym}</span>
                  <span className="text-ink-muted dark:text-ink-muted-dark">{count}x logged</span>
                </div>
              ))}
            </div>
          </>
        )}

        {avgPain && (
          <>
            <h2 className="text-base font-semibold text-primary border-b border-secondary pb-1 mt-6 mb-3">Pain</h2>
            <div className="section">
              <p className="text-sm text-ink dark:text-gray-200">Average pain level: {avgPain}/10</p>
              {painEntries.length >= 2 && (
                <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-1">
                  Recent trend: {painEntries.slice(-3).map(e => e.pain).join(' → ')}
                </p>
              )}
            </div>
          </>
        )}

        {topMoods.length > 0 && (
          <>
            <h2 className="text-base font-semibold text-primary border-b border-secondary pb-1 mt-6 mb-3">Mood Pattern</h2>
            <div className="section">
              {topMoods.map(([mood, count]) => (
                <div key={mood} className="flex items-center justify-between py-1 text-sm">
                  <span className="text-ink dark:text-gray-200">{mood}</span>
                  <span className="text-ink-muted dark:text-ink-muted-dark">{count}x logged</span>
                </div>
              ))}
            </div>
          </>
        )}

        {symptoms.some(s => s.notes) && (
          <>
            <h2 className="text-base font-semibold text-primary border-b border-secondary pb-1 mt-6 mb-3">Recent Notes</h2>
            <div className="section">
              {symptoms.filter(s => s.notes).slice(-5).map(s => (
                <div key={s.id} className="py-1 text-sm">
                  <span className="text-ink-muted dark:text-ink-muted-dark">{new Date(s.entry_date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' })}: </span>
                  <span className="text-ink dark:text-gray-200 italic">"{s.notes}"</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="disclaimer mt-6 p-3 bg-warning-50 dark:bg-warning-900/20 rounded-lg text-xs text-ink-muted dark:text-ink-muted-dark">
          <p>This report summarises information recorded in FemCare+. It is not a medical diagnosis. Please share this with your healthcare professional for proper evaluation.</p>
        </div>
      </div>
    </div>
  );
}
