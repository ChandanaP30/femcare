import { displaySymptom } from '@/lib/symptom-names';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Period, DailyLog } from '@/lib/types';
import { getPredictedPeriodDates, getFertileWindows, ovulationOffset, addDays, parseDate, formatDateShort, todayStr, toDateStr } from '@/lib/cycle';
import { ChevronLeft, ChevronRight, Droplet, Sparkles, Egg, Heart, CalendarDays } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { PageHeader, HeaderArt } from '@/components/PageHeader';

type DayCategory = 'period' | 'predicted' | 'fertile';

// Soft continuous bands behind consecutive days of the same kind.
const BAND: Record<DayCategory, string> = {
  period: 'bg-accent-200 dark:bg-accent-600/25',
  predicted: 'bg-primary-100 dark:bg-primary-900/40',
  fertile: 'bg-success-200/80 dark:bg-success-700/25',
};

export function CalendarScreen() {
  const { profile, user } = useAuth();
  const { t, lang } = useLanguage();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [dailyLogs, setDailyLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [startingPeriod, setStartingPeriod] = useState(false);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [periodsRes, logsRes] = await Promise.all([
      supabase.from('periods').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
      supabase.from('daily_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }),
    ]);

    setPeriods(periodsRes.data as Period[] || []);
    setDailyLogs(logsRes.data as DailyLog[] || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const predictedPeriods = profile ? getPredictedPeriodDates(profile, periods, 4) : [];
  const fertileWindows = profile ? getFertileWindows(profile, periods, 4) : [];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startWeekday = firstDay.getDay();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const weekdayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  function dateStr(y: number, m: number, d: number): string {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Only real logged ranges count as period days. Capped at 10 days so a bad end_date cannot fill the month.
  const MAX_PERIOD_DAYS = 10;
  function daysInRange(start: Date, end: Date): string[] {
    const out: string[] = [];
    for (let d = new Date(start); d <= end; d = addDays(d, 1)) out.push(toDateStr(d));
    return out;
  }

  const loggedPeriodDays = new Set<string>();
  for (const p of periods) {
    const start = parseDate(p.start_date);
    if (!start) continue;
    let end = p.end_date ? parseDate(p.end_date) : null;
    if (!end || end < start) end = addDays(start, (profile?.period_duration || 5) - 1);
    const maxEnd = addDays(start, MAX_PERIOD_DAYS - 1);
    if (end > maxEnd) end = maxEnd;
    daysInRange(start, end).forEach((s) => loggedPeriodDays.add(s));
  }

  const predictedDays = new Set<string>();
  for (const pp of predictedPeriods) {
    const start = parseDate(pp.start);
    const end = parseDate(pp.end);
    if (start && end) daysInRange(start, end).forEach((s) => predictedDays.add(s));
  }

  const fertileDays = new Set<string>();
  const ovulationDays = new Set<string>();
  for (const fw of fertileWindows) {
    const start = parseDate(fw.start);
    const end = parseDate(fw.end);
    if (start && end) daysInRange(start, end).forEach((s) => fertileDays.add(s));
    if (fw.ovulation) ovulationDays.add(fw.ovulation);
  }

  // Past cycles: estimate ovulation and fertile days from each real gap between logged period starts.
  const loggedStarts = periods
    .map((p) => parseDate(p.start_date))
    .filter((d): d is Date => d !== null)
    .sort((a, b) => a.getTime() - b.getTime());
  for (let i = 0; i < loggedStarts.length - 1; i++) {
    const len = Math.round((loggedStarts[i + 1].getTime() - loggedStarts[i].getTime()) / 86400000);
    if (len < 15 || len > 60) continue;
    const ov = addDays(loggedStarts[i], ovulationOffset(len));
    ovulationDays.add(toDateStr(ov));
    for (let d = addDays(ov, -4); d <= addDays(ov, 1); d = addDays(d, 1)) fertileDays.add(toDateStr(d));
  }

  function categoryOf(ds: string): DayCategory | null {
    if (loggedPeriodDays.has(ds)) return 'period';
    if (predictedDays.has(ds)) return 'predicted';
    if (fertileDays.has(ds) || ovulationDays.has(ds)) return 'fertile';
    return null;
  }

  function getDayInfo(dateString: string) {
    const isPeriod = loggedPeriodDays.has(dateString);
    return {
      isPeriod,
      isPredicted: !isPeriod && predictedDays.has(dateString),
      isOvulation: ovulationDays.has(dateString),
      isFertile: fertileDays.has(dateString),
      hasSymptoms: dailyLogs.some((l) => l.log_date === dateString && l.symptoms.length > 0),
      isToday: dateString === todayStr(),
    };
  }

  async function startPeriod(date: string) {
    if (!user) return;
    setStartingPeriod(true);

    // Check if there's already a period within 10 days of this date
    const existing = periods.find((p) => {
      const diff = Math.abs(new Date(p.start_date).getTime() - new Date(date).getTime());
      return diff < 10 * 24 * 60 * 60 * 1000;
    });

    if (existing) {
      // Update existing period start date
      const { error } = await supabase.from('periods').update({ start_date: date }).eq('id', existing.id);
      if (!error) {
        await loadData();
        // Update profile last_period_date if this is the most recent
        if (profile) {
          await supabase.from('profiles').update({ last_period_date: date }).eq('id', user.id);
        }
      }
    } else {
      const { error } = await supabase.from('periods').insert({
        user_id: user.id,
        start_date: date,
        notes: '',
      });
      if (!error) {
        await loadData();
        if (profile) {
          await supabase.from('profiles').update({ last_period_date: date }).eq('id', user.id);
        }
      }
    }

    setStartingPeriod(false);
    setShowStartDialog(false);
  }

  async function endPeriod(period: Period) {
    if (!user) return;
    const today = todayStr();
    const { error } = await supabase.from('periods').update({ end_date: today }).eq('id', period.id);
    if (!error) loadData();
  }

  async function deletePeriod(period: Period) {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this period record? This cannot be undone.')) return;
    const { error } = await supabase.from('periods').delete().eq('id', period.id);
    if (!error) loadData();
  }

  const selectedInfo = selectedDate ? getDayInfo(selectedDate) : null;
  const selectedPeriod = selectedDate ? periods.find((p) => {
    const start = parseDate(p.start_date);
    const end = p.end_date ? parseDate(p.end_date) : addDays(start!, (profile?.period_duration || 5) - 1);
    const d = parseDate(selectedDate);
    return !!(d && start && end && d >= start && d <= end);
  }) : null;
  const selectedLog = selectedDate ? dailyLogs.find((l) => l.log_date === selectedDate) : null;
  const selectedDateObj = selectedDate ? parseDate(selectedDate) : null;

  // Next predicted period, shown as a small pill in the header
  const todayD = parseDate(todayStr());
  const upcoming = predictedPeriods
    .map((pp) => parseDate(pp.start))
    .filter((d): d is Date => d !== null && !!todayD && d.getTime() >= todayD.getTime())
    .sort((a, b) => a.getTime() - b.getTime());
  const nextStart = upcoming[0] ?? null;
  const daysUntil = nextStart && todayD ? Math.round((nextStart.getTime() - todayD.getTime()) / 86400000) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const navBtn = 'relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/70 text-ink shadow-soft transition-colors hover:bg-white dark:bg-white/10 dark:hover:bg-white/20';

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title={t('periodCalendar')} subtitle={t('trackCyclePredictions')} art="bloom">
        {nextStart && (
          <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-white/70 px-3.5 py-2 text-sm text-ink dark:bg-white/10">
            <Droplet size={14} className="shrink-0 text-primary-700 dark:text-primary-300" fill="currentColor" />
            <span className="truncate">
              {t('nextPeriod')}: <span className="font-semibold">{formatDateShort(nextStart)}</span>
              {daysUntil !== null && (
                <span className="text-ink-muted"> {'\u00b7'} {daysUntil > 0 ? t('inAboutDays', { n: daysUntil }) : t('dueNow')}</span>
              )}
            </span>
          </div>
        )}
      </PageHeader>

      {/* Calendar */}
      <section className="card relative overflow-hidden p-4">
        <HeaderArt art="sprig" className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 opacity-40" />

        <div className="relative mb-5 flex items-center justify-between">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className={navBtn} aria-label="Previous month">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ink-muted">{year}</p>
            <h2 className="font-serif text-2xl text-ink">{monthNames[month]}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setViewDate(new Date())} className={navBtn} aria-label="Go to today">
              <CalendarDays size={18} />
            </button>
            <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className={navBtn} aria-label="Next month">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="relative mb-1 grid grid-cols-7">
          {weekdayNames.map((d, i) => (
            <div key={i} className="py-1 text-center text-[11px] font-medium uppercase tracking-wider text-ink-muted">{d}</div>
          ))}
        </div>

        <div className="relative grid grid-cols-7 gap-y-1">
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const ds = dateStr(year, month, day);
            const info = getDayInfo(ds);
            const cat = categoryOf(ds);
            const col = (startWeekday + i) % 7;
            const prevSame = !!cat && col !== 0 && day > 1 && categoryOf(dateStr(year, month, day - 1)) === cat;
            const nextSame = !!cat && col !== 6 && day < daysInMonth && categoryOf(dateStr(year, month, day + 1)) === cat;

            const circle = info.isPeriod
              ? 'bg-accent-500 font-semibold text-ink-onlight shadow-soft'
              : info.isPredicted
              ? 'border border-dashed border-primary-600 text-ink dark:border-primary-300'
              : info.isOvulation
              ? 'bg-warning-300 font-semibold text-ink-onlight shadow-soft'
              : info.isFertile
              ? 'text-ink'
              : 'text-ink hover:bg-primary-50 dark:hover:bg-white/5';

            return (
              <div key={day} className="relative flex h-11 items-center justify-center">
                {cat && (
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-1 ${prevSame ? 'left-0' : 'left-0.5 rounded-l-full'} ${nextSame ? 'right-0' : 'right-0.5 rounded-r-full'} ${BAND[cat]}`}
                  />
                )}
                <button
                  onClick={() => setSelectedDate(ds)}
                  aria-pressed={selectedDate === ds}
                  className={`relative z-10 flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors ${circle} ${
                    info.isToday ? 'font-bold underline decoration-2 underline-offset-4 decoration-primary-700 dark:decoration-primary-200' : ''
                  } ${selectedDate === ds ? 'ring-2 ring-primary-700 ring-offset-1 ring-offset-bg-card dark:ring-primary-200' : ''}`}
                >
                  {day}
                  {info.hasSymptoms && !info.isPeriod && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-success-600 dark:bg-success-400" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="relative mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-primary-100 pt-4 text-xs dark:border-white/10">
          <LegendItem swatch="bg-accent-500" label={t('period')} />
          <LegendItem swatch="border border-dashed border-primary-600 dark:border-primary-300" label={t('predicted')} />
          <LegendItem swatch="bg-success-200 dark:bg-success-700/40" label={t('fertile')} />
          <LegendItem swatch="bg-warning-300" label={t('ovulation')} />
        </div>
      </section>

      {/* Selected date details */}
      {selectedDate && (
        <section className="card p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-100 font-serif text-xl text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
              {selectedDateObj?.getDate()}
            </span>
            <div className="min-w-0">
              <p className="font-serif text-lg text-ink">{formatDateShort(selectedDate)}</p>
              <p className="text-xs text-ink-muted">{selectedDateObj?.toLocaleDateString('en-US', { weekday: 'long' })}</p>
            </div>
          </div>

          {selectedInfo?.isPeriod && selectedPeriod ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent-200 px-3 py-1.5 text-sm font-medium text-ink-onlight dark:bg-accent-600/25 dark:text-accent-300">
                <Droplet size={16} fill="currentColor" />
                {t('periodActive')}
              </div>
              <p className="text-sm text-ink-muted">
                {t('started')} {formatDateShort(selectedPeriod.start_date)}
                {selectedPeriod.end_date ? ' \u2022 ' + t('ended') + ' ' + formatDateShort(selectedPeriod.end_date) : ''}
              </p>
              {!selectedPeriod.end_date && selectedDate === todayStr() && (
                <button onClick={() => endPeriod(selectedPeriod)} className="btn-secondary w-full text-sm">
                  {t('endPeriodToday')}
                </button>
              )}
              <button onClick={() => deletePeriod(selectedPeriod)} className="btn-ghost w-full text-sm text-error-600 dark:text-error-300">
                {t('deletePeriodRecord')}
              </button>
            </div>
          ) : selectedInfo?.isPredicted ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3 py-1.5 text-sm font-medium text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
                <Sparkles size={16} />
                {t('predictedPeriodDay')}
              </div>
              <p className="text-sm text-ink-muted">{t('estimatedPeriodDate')}</p>
              <button onClick={() => startPeriod(selectedDate)} className="btn-primary w-full text-sm">
                {t('startPeriodOnDay')}
              </button>
            </div>
          ) : selectedInfo?.isFertile ? (
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-success-200 px-3 py-1.5 text-sm font-medium text-success-700 dark:bg-success-700/30 dark:text-success-300">
                {selectedInfo.isOvulation ? <Egg size={16} /> : <Heart size={16} />}
                {selectedInfo.isOvulation ? t('estimatedOvulation') : t('fertileWindow')}
              </div>
              <p className="text-sm text-ink-muted">
                {selectedInfo.isOvulation ? t('mostFertile') : t('inFertileWindow')}
              </p>
              <button onClick={() => setShowStartDialog(true)} className="btn-secondary w-full text-sm">
                {t('startPeriodOnDay')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">
                {selectedLog ? t('symptomsLogged') : t('noDataLogged')}
              </p>
              {selectedLog && (
                <div className="space-y-2 text-sm">
                  {selectedLog.mood && <p className="text-ink">Mood: <span className="text-ink-muted">{selectedLog.mood}</span></p>}
                  {selectedLog.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedLog.symptoms.map((s) => (
                        <span key={s} className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">{displaySymptom(s, lang)}</span>
                      ))}
                    </div>
                  )}
                  {selectedLog.pain_level > 0 && <p className="text-ink">Pain: <span className="text-ink-muted">{selectedLog.pain_level}/10</span></p>}
                </div>
              )}
              <button onClick={() => setShowStartDialog(true)} className="btn-primary w-full text-sm">
                {t('startPeriodOnDay')}
              </button>
            </div>
          )}
        </section>
      )}

      {/* Start period dialog */}
      {showStartDialog && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowStartDialog(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="card relative w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 font-serif text-lg text-ink">{t('startPeriodConfirm')}</h3>
            <p className="mb-5 text-sm text-ink-muted">
              {t('willRecordDate', { date: formatDateShort(selectedDate) })}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowStartDialog(false)} className="btn-ghost flex-1">{t('cancel')}</button>
              <button onClick={() => startPeriod(selectedDate)} disabled={startingPeriod} className="btn-primary flex-1">
                {startingPeriod ? t('saving') : t('startPeriod')}
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="text-center text-xs text-ink-muted">
        {t('cyclePredictionsEstimates')}
      </p>
    </div>
  );
}

function LegendItem({ swatch, label }: { swatch: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-3.5 w-3.5 rounded-full ${swatch}`} />
      <span className="text-ink-muted">{label}</span>
    </div>
  );
}