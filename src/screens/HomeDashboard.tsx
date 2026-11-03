import { createPortal } from 'react-dom';
import { Sparkles as FabSparkles } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import type { Period, DailyLog } from '@/lib/types';
import MLCyclePrediction from '@/components/MLCyclePrediction';
import { HeroBloom, PhaseIllustration } from '@/components/illustrations';
import { computeCycleInfo, formatDateShort, parseDate, todayStr } from '@/lib/cycle';
import { MOODS, PHYSICAL_SYMPTOMS, EMOTIONAL_SYMPTOMS } from '@/lib/symptoms';
import { CalendarPlus, Activity, Siren, MapPin, MessageCircle, ShieldCheck, ChevronRight, Droplet } from 'lucide-react';
import type { NavKey } from '@/components/nav-items';

interface HomeDashboardProps {
  onNavigate: (page: string) => void;
  onNavChange: (nav: NavKey) => void;
}

export function HomeDashboard({ onNavigate, onNavChange }: HomeDashboardProps) {
  const { profile, user } = useAuth();
  const { t } = useLanguage();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [todayLog, setTodayLog] = useState<DailyLog | null>(null);
  const [recentLogs, setRecentLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [mood, setMood] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [painLevel, setPainLevel] = useState(0);
  const [notes, setNotes] = useState('');
  const [savingLog, setSavingLog] = useState(false);
  const [logSaved, setLogSaved] = useState(false);

  const today = todayStr();

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const [periodsRes, logRes, recentRes] = await Promise.all([
      supabase.from('periods').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
      supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('log_date', today).maybeSingle(),
      supabase.from('daily_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }).limit(7),
    ]);

    setPeriods((periodsRes.data as Period[]) || []);
    setRecentLogs((recentRes.data as DailyLog[]) || []);
    const log = logRes.data as DailyLog | null;
    setTodayLog(log);
    if (log) {
      setMood(log.mood);
      setSymptoms(log.symptoms || []);
      setPainLevel(log.pain_level || 0);
      setNotes(log.notes || '');
    }
    setLoading(false);
  }, [user, today]);

  useEffect(() => { loadData(); }, [loadData]);

  const cycleInfo = profile ? computeCycleInfo(profile, periods) : null;

  // Average of real logged cycles (gaps between period starts, 15 to 60 days), same basis as Period History.
  const historyAverage = (() => {
    const starts = periods
      .map((p) => parseDate(p.start_date))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    const lens: number[] = [];
    for (let i = 1; i < starts.length; i++) {
      const len = Math.round((starts[i].getTime() - starts[i - 1].getTime()) / 86400000);
      if (len >= 15 && len <= 60) lens.push(len);
    }
    return lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : null;
  })();

  // Most frequent symptoms over the last 7 logged days
  const recentSymptoms = (() => {
    const counts = new Map<string, number>();
    recentLogs.forEach((l) => (l.symptoms || []).forEach((s) => counts.set(s, (counts.get(s) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  })();

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning');
    if (hour < 18) return t('goodAfternoon');
    if (hour < 22) return t('goodEvening');
    return t('goodNight');
  })();

  const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const phaseKey = cycleInfo
    ? cycleInfo.phase === 'menstrual' ? 'menstrualPhase'
      : cycleInfo.phase === 'follicular' ? 'follicularPhase'
      : cycleInfo.phase === 'ovulation' ? 'ovulationPhase'
      : 'lutealPhase'
    : null;

  const phaseDescKey = cycleInfo
    ? cycleInfo.phase === 'menstrual' ? 'phaseMenstrualDesc'
      : cycleInfo.phase === 'follicular' ? 'phaseFollicularDesc'
      : cycleInfo.phase === 'ovulation' ? 'phaseOvulationDesc'
      : 'phaseLutealDesc'
    : null;

  const confidenceLabel = cycleInfo
    ? cycleInfo.confidence >= 70 ? t('confidenceHigh')
      : cycleInfo.confidence >= 40 ? t('confidenceMedium')
      : t('confidenceLow')
    : null;

  function mergeRecent(log: DailyLog) {
    setRecentLogs((prev) => [log, ...prev.filter((l) => l.log_date !== log.log_date)].slice(0, 7));
  }

  async function saveCheckIn() {
    if (!user) return;
    setSavingLog(true);

    const logData = {
      user_id: user.id,
      log_date: today,
      mood,
      symptoms,
      pain_level: painLevel,
      notes,
    };

    if (todayLog) {
      const { error } = await supabase.from('daily_logs').update(logData).eq('id', todayLog.id);
      if (!error) {
        const updated = { ...todayLog, ...logData };
        setTodayLog(updated);
        mergeRecent(updated);
        setLogSaved(true);
      }
    } else {
      const { data, error } = await supabase.from('daily_logs').insert(logData).select().single();
      if (!error && data) {
        setTodayLog(data as DailyLog);
        mergeRecent(data as DailyLog);
        setLogSaved(true);
      }
    }

    setSavingLog(false);
    setTimeout(() => setLogSaved(false), 3000);
  }

  function toggleSymptom(s: string) {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Hero */}
      <section className="hero-surface relative overflow-hidden rounded-3xl border border-white/60 dark:border-white/10 p-5 shadow-soft">
        <HeroBloom className="pointer-events-none absolute -right-3 -top-2 h-32 w-32" />
        <div className="relative pr-24">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{todayLabel}</p>
          <h1 className="mt-1.5 break-words font-serif text-2xl text-ink">
            {greeting}, {profile?.name || 'there'}
          </h1>
        </div>

        {cycleInfo && phaseKey && phaseDescKey ? (
          <div className="relative mt-5 flex items-center gap-4">
            <CycleRing day={cycleInfo.currentDay} total={cycleInfo.cycleLength} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-ink-muted">
                {t('cycleDay')} {cycleInfo.currentDay} / {cycleInfo.cycleLength}
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/70 px-2.5 py-1 text-sm font-medium text-ink dark:bg-white/10">
                <PhaseIllustration phase={cycleInfo.phase} className="h-4 w-4 text-primary-700 dark:text-primary-200" />
                {t(phaseKey)}
              </span>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{t(phaseDescKey)}</p>
            </div>
          </div>
        ) : (
          <div className="relative mt-5">
            <div className="mb-2 flex items-center gap-2.5">
              <Droplet className="text-primary-700 dark:text-primary-200" size={20} />
              <h2 className="font-serif text-lg text-ink">{t('welcomeToFemcare')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-ink-muted">{t('startByLogging')}</p>
            <button onClick={() => onNavigate('log-period')} className="btn-primary mt-4 flex items-center gap-2">
              <CalendarPlus size={18} />
              {t('logPeriod')}
            </button>
          </div>
        )}
      </section>

      {cycleInfo && (
        <>
          {/* Next period */}
          <section className="card p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{t('nextPeriod')}</p>
              {confidenceLabel && <span className="text-xs text-ink-muted">{confidenceLabel}</span>}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <p className="font-serif text-3xl text-ink">{formatDateShort(cycleInfo.nextPeriodDate)}</p>
              <span className="inline-flex items-center rounded-full bg-accent-300 px-3 py-1 text-sm font-medium text-ink-onlight dark:bg-accent-600/30 dark:text-accent-300">
                {cycleInfo.daysUntilNextPeriod > 0 ? t('inAboutDays', { n: cycleInfo.daysUntilNextPeriod }) : t('dueNow')}
              </span>
            </div>

            <PhaseBar
              cycleLength={cycleInfo.cycleLength}
              periodDuration={cycleInfo.periodDuration}
              currentDay={cycleInfo.currentDay}
              labels={[t('menstrualPhase'), t('follicularPhase'), t('ovulationPhase'), t('lutealPhase')]}
            />

            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-primary-100 pt-4 dark:border-white/10">
              <Stat label="Predicted next cycle" value={`${cycleInfo.cycleLength} d`} />
              <Stat label="Your average cycle" value={`${historyAverage ?? profile?.cycle_length ?? 28} d`} />
              <Stat label={t('periodDuration')} value={`${cycleInfo.periodDuration} d`} />
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="mt-4 flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800 dark:text-primary-300 dark:hover:text-primary-200"
            >
              {t('viewPeriodHistory')}
              <ChevronRight size={16} />
            </button>
          </section>

          {periods.length > 0 && (
            <MLCyclePrediction
              periodStarts={periods.map((p) => p.start_date)}
              appNextPeriodDate={cycleInfo.nextPeriodDate}
            />
          )}

          {cycleInfo.confidence < 40 && (
            <p className="rounded-2xl bg-accent-100 px-4 py-3 text-center text-sm text-ink-muted dark:bg-accent-600/20">
              {t('logFewMoreCycles')}
            </p>
          )}
        </>
      )}

      {/* Quick actions */}
      <section>
        <h3 className="section-title mb-3">{t('quickActions')}</h3>
        <div className="grid grid-cols-3 gap-3">
          <QuickAction icon={CalendarPlus} label={t('logPeriod')} onClick={() => onNavigate('log-period')} tone="primary" />
          <QuickAction icon={Activity} label={t('logSymptoms')} onClick={() => onNavigate('symptoms')} tone="accent" />
          <QuickAction icon={Siren} label={t('sos')} onClick={() => onNavChange('sos')} tone="error" />
          <QuickAction icon={MapPin} label={t('findPads')} onClick={() => onNavigate('locator')} tone="success" />
          <QuickAction icon={ShieldCheck} label={t('leaveGuide')} onClick={() => onNavigate('leave-guide')} tone="primary" />
          <QuickAction icon={MessageCircle} label={t('askAI')} onClick={() => onNavigate('chat')} tone="warning" />
          {createPortal(
            <button
              onClick={() => onNavigate('chat')}
              aria-label="Ask AI"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)' }}
              className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-accent-500 text-white shadow-lg transition-transform active:scale-95"
            >
              <FabSparkles size={24} />
            </button>,
            document.body
          )}
        </div>
      </section>

      {/* Recent symptoms */}
      <section className="card p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="section-title">{t('symptoms')}</h3>
          <button
            onClick={() => onNavigate('symptoms')}
            className="flex items-center gap-1 text-sm font-medium text-primary-700 dark:text-primary-300"
          >
            {t('logSymptoms')}
            <ChevronRight size={16} />
          </button>
        </div>
        {recentSymptoms.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {recentSymptoms.map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-3 py-1 text-xs font-medium text-primary-800 dark:bg-primary-900/50 dark:text-primary-200"
              >
                {name}
                {count > 1 && <span className="opacity-70">&times;{count}</span>}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-ink-muted">{t('trackHowYouFeel')}</p>
        )}
      </section>

      {/* Daily check-in */}
      <section className="card p-5">
        <h3 className="section-title">{t('todaysCheckin')}</h3>
        <p className="mb-5 mt-1 text-sm text-ink-muted">{t('trackHowYouFeel')}</p>

        <div className="mb-6 flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMood(mood === m.key ? '' : m.key)}
              aria-pressed={mood === m.key}
              className={`chip ${
                mood === m.key
                  ? 'bg-primary-100 text-ink ring-2 ring-primary-400 dark:bg-primary-900/50'
                  : 'bg-bg-card text-ink-muted ring-1 ring-primary-100 dark:ring-white/15'
              }`}
            >
              <span className="text-lg">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>

        <p className="label-text">{t('symptoms')}</p>
        <div className="mb-6 flex flex-wrap gap-2">
          {[...PHYSICAL_SYMPTOMS.slice(0, 5), ...EMOTIONAL_SYMPTOMS.slice(0, 3)].map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              aria-pressed={symptoms.includes(s)}
              className={`chip text-xs ${
                symptoms.includes(s)
                  ? 'bg-primary-500 text-ink-onlight'
                  : 'bg-bg-card text-ink-muted ring-1 ring-primary-100 dark:ring-white/15'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label htmlFor="pain-level" className="label-text">
            {t('painLevel')}: <span className="font-semibold text-primary-700 dark:text-primary-300">{painLevel}/10</span>
          </label>
          <input
            id="pain-level"
            type="range"
            min={0}
            max={10}
            value={painLevel}
            onChange={(e) => setPainLevel(Number(e.target.value))}
            className="w-full accent-primary-500"
          />
          <div className="mt-1 flex justify-between text-xs text-ink-muted">
            <span>{t('noPain')}</span>
            <span>{t('severe')}</span>
          </div>
        </div>

        <div className="mb-6">
          <label htmlFor="checkin-notes" className="label-text">
            {t('notes')} <span className="font-normal text-ink-muted">({t('optional')})</span>
          </label>
          <textarea
            id="checkin-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('anythingElseNote')}
            rows={2}
            className="input-field resize-none"
          />
        </div>

        <button onClick={saveCheckIn} disabled={savingLog} className="btn-primary flex w-full items-center justify-center gap-2">
          {savingLog ? t('saving') : logSaved ? t('saved') : t('save')}
        </button>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-xs text-ink-muted">{label}</p>
      <p className="mt-1 font-semibold text-ink">{value}</p>
    </div>
  );
}

function CycleRing({ day, total }: { day: number; total: number }) {
  const r = 38;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(day / Math.max(total, 1), 1);

  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg viewBox="0 0 96 96" className="h-24 w-24 -rotate-90" aria-hidden="true">
        <circle cx="48" cy="48" r={r} fill="none" strokeWidth="7" className="stroke-white/70 dark:stroke-white/10" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="stroke-primary-500 dark:stroke-primary-300"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-3xl text-ink">{day}</span>
      </div>
    </div>
  );
}

const SEGMENT_STYLES = [
  'bg-error-300 dark:bg-error-500/70',
  'bg-success-300 dark:bg-success-500/60',
  'bg-primary-300 dark:bg-primary-400/70',
  'bg-accent-300 dark:bg-accent-500/60',
];

function PhaseBar({
  cycleLength,
  periodDuration,
  currentDay,
  labels,
}: {
  cycleLength: number;
  periodDuration: number;
  currentDay: number;
  labels: string[];
}) {
  const total = Math.max(cycleLength, 20);
  const m = Math.min(Math.max(periodDuration, 1), total - 10);
  const ovDay = Math.max(total - 14, m + 3);
  const ovStart = Math.max(ovDay - 1, m + 1);
  const ovEnd = Math.min(ovDay + 1, total - 1);
  const days = [m, ovStart - 1 - m, ovEnd - ovStart + 1, total - ovEnd];
  const markerLeft = Math.min(Math.max(((currentDay - 0.5) / total) * 100, 2), 98);

  return (
    <div className="mt-5">
      <div className="relative">
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {days.map((d, i) => (
            <div key={i} className={SEGMENT_STYLES[i]} style={{ flex: `${Math.max(d, 0)} 1 0%` }} />
          ))}
        </div>
        <span
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg-card bg-ink shadow-soft"
          style={{ left: `${markerLeft}%` }}
        />
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {labels.map((label, i) => (
          <li key={i} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className={`h-2 w-2 rounded-full ${SEGMENT_STYLES[i]}`} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const TONES: Record<string, string> = {
  primary: 'bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-200',
  accent: 'bg-accent-300 text-ink-onlight dark:bg-accent-600/30 dark:text-accent-300',
  success: 'bg-success-200 text-success-700 dark:bg-success-700/30 dark:text-success-300',
  error: 'bg-error-100 text-error-600 dark:bg-error-600/30 dark:text-error-200',
  warning: 'bg-warning-100 text-warning-600 dark:bg-warning-600/30 dark:text-warning-200',
};

function QuickAction({
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  icon: typeof CalendarPlus;
  label: string;
  onClick: () => void;
  tone: string;
}) {
  return (
    <button
      onClick={onClick}
      className="card flex flex-col items-center gap-2 px-2 py-3.5 transition-shadow hover:shadow-lift focus:outline-none focus:ring-2 focus:ring-primary-300"
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${TONES[tone]}`}>
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span className="text-center text-xs font-medium leading-snug text-ink">{label}</span>
    </button>
  );
}