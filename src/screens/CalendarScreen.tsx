import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { Period, DailyLog } from '@/lib/types';
import { getPredictedPeriodDates, getFertileWindows, ovulationOffset, addDays, parseDate, formatDateShort, todayStr, toDateStr } from '@/lib/cycle';
import { ChevronLeft, ChevronRight, Droplet, Sparkles, Egg, Heart } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

export function CalendarScreen() {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('periodCalendar')}</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">{t('trackCyclePredictions')}</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <LegendItem icon={Droplet} color="bg-primary-500" label={t('period')} />
        <LegendItem icon={Sparkles} color="bg-primary-200 dark:bg-primary-800" label={t('predicted')} />
        <LegendItem icon={Heart} color="bg-accent-300" label={t('fertile')} />
        <LegendItem icon={Egg} color="bg-warning-400" label={t('ovulation')} />
      </div>

      {/* Calendar */}
      <div className="card p-4 lg:p-6">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
            <ChevronLeft size={20} />
          </button>
          <h2 className="font-serif text-lg font-semibold text-neutral-900 dark:text-neutral-100">
            {monthNames[month]} {year}
          </h2>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdayNames.map((d, i) => (
            <div key={i} className="text-center text-xs font-medium text-neutral-400 py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const ds = dateStr(year, month, day);
            const info = getDayInfo(ds);

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(ds)}
                className={`relative aspect-square flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                  selectedDate === ds
                    ? 'ring-2 ring-primary-400'
                    : ''
                } ${
                  info.isPeriod
                    ? 'bg-primary-400 text-ink font-semibold'
                    : info.isPredicted
                    ? 'bg-primary-200 text-ink ring-1 ring-primary-400'
                    : info.isOvulation
                    ? 'bg-warning-300 text-ink font-semibold'
                    : info.isFertile
                    ? 'bg-accent-300 text-ink'
                    : info.isToday
                    ? 'bg-neutral-200 dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100'
                    : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700/50'
                }`}
              >
                {day}
                {info.hasSymptoms && !info.isPeriod && (
                  <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-success-500" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected date details */}
      {selectedDate && (
        <div className="card p-5 animate-slide-up">
          <h3 className="font-serif text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
            {formatDateShort(selectedDate)}
          </h3>

          {selectedInfo?.isPeriod && selectedPeriod ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary-600 dark:text-primary-400">
                <Droplet size={18} fill="currentColor" />
                <span className="font-medium text-sm">{t('periodActive')}</span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('started')} {formatDateShort(selectedPeriod.start_date)}
          {selectedPeriod.end_date ? ' Ã¢â‚¬Â¢ ' + t('ended') + ' ' + formatDateShort(selectedPeriod.end_date) : ''}
              </p>
              {!selectedPeriod.end_date && selectedDate === todayStr() && (
                <button onClick={() => endPeriod(selectedPeriod)} className="btn-secondary text-sm w-full">
                  {t('endPeriodToday')}
                </button>
              )}
              <button onClick={() => deletePeriod(selectedPeriod)} className="btn-ghost text-sm text-error-600 dark:text-error-400 w-full">
                {t('deletePeriodRecord')}
              </button>
            </div>
          ) : selectedInfo?.isPredicted ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-primary-500">
                <Sparkles size={18} />
                <span className="font-medium text-sm">{t('predictedPeriodDay')}</span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">{t('estimatedPeriodDate')}</p>
              <button onClick={() => startPeriod(selectedDate)} className="btn-primary text-sm w-full">
                {t('startPeriodOnDay')}
              </button>
            </div>
          ) : selectedInfo?.isFertile ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-accent-600 dark:text-accent-400">
                {selectedInfo.isOvulation ? <Egg size={18} /> : <Heart size={18} />}
                <span className="font-medium text-sm">{selectedInfo.isOvulation ? t('estimatedOvulation') : t('fertileWindow')}</span>
              </div>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {selectedInfo.isOvulation
                  ? t('mostFertile')
                  : t('inFertileWindow')}
              </p>
              <button onClick={() => setShowStartDialog(true)} className="btn-secondary text-sm w-full">
                {t('startPeriodOnDay')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {selectedLog ? t('symptomsLogged') : t('noDataLogged')}
              </p>
              {selectedLog && (
                <div className="space-y-1.5 text-sm">
                  {selectedLog.mood && <p className="text-neutral-600 dark:text-neutral-400">Mood: {selectedLog.mood}</p>}
                  {selectedLog.symptoms.length > 0 && <p className="text-neutral-600 dark:text-neutral-400">Symptoms: {selectedLog.symptoms.join(', ')}</p>}
                  {selectedLog.pain_level > 0 && <p className="text-neutral-600 dark:text-neutral-400">Pain: {selectedLog.pain_level}/10</p>}
                </div>
              )}
              <button onClick={() => setShowStartDialog(true)} className="btn-primary text-sm w-full">
                {t('startPeriodOnDay')}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Start period dialog */}
      {showStartDialog && selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowStartDialog(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative card p-6 max-w-sm w-full animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-serif text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-2">{t('startPeriodConfirm')}</h3>
            <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">
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

      <p className="text-xs text-neutral-400 dark:text-neutral-500 text-center">
        {t('cyclePredictionsEstimates')}
      </p>
    </div>
  );
}

function LegendItem({ icon: Icon, color, label }: { icon: typeof Droplet; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-md ${color} flex items-center justify-center`}>
        <Icon size={12} className="text-white" />
      </div>
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
    </div>
  );
}
