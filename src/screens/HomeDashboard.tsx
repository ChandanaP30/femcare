import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import type { Period, DailyLog } from '@/lib/types';
import MLCyclePrediction from '@/components/MLCyclePrediction';
import BotanicalAccent from '@/components/BotanicalAccent';
import { computeCycleInfo, formatDateShort, todayStr } from '@/lib/cycle';
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

    const [periodsRes, logRes] = await Promise.all([
      supabase.from('periods').select('*').eq('user_id', user.id).order('start_date', { ascending: false }),
      supabase.from('daily_logs').select('*').eq('user_id', user.id).eq('log_date', today).maybeSingle(),
    ]);

    setPeriods((periodsRes.data as Period[]) || []);
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
        setTodayLog({ ...todayLog, ...logData });
        setLogSaved(true);
      }
    } else {
      const { data, error } = await supabase.from('daily_logs').insert(logData).select().single();
      if (!error && data) {
        setTodayLog(data as DailyLog);
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
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{todayLabel}</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink mt-1.5 break-words">
            {greeting}, {profile?.name || 'there'}
          </h1>
        </div>
        <BotanicalAccent size={44} className="hidden sm:block shrink-0 text-primary-400" />
      </header>

      {cycleInfo && phaseKey && phaseDescKey ? (
        <>
          {/* Compact cycle phase */}
          <section className="card p-5 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-ink-muted">{t('cycleDay')} {cycleInfo.currentDay}</p>
              <h2 className="font-serif text-lg text-ink mt-0.5">{t(phaseKey)}</h2>
              <p className="text-sm text-ink-muted mt-1 leading-relaxed">{t(phaseDescKey)}</p>
            </div>
            <CycleRing day={cycleInfo.currentDay} total={cycleInfo.cycleLength} />
          </section>

          {/* Prominent next period */}
          <section className="card p-6 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">{t('nextPeriod')}</p>
              {confidenceLabel && <span className="text-xs text-ink-muted">{confidenceLabel}</span>}
            </div>
            <p className="font-serif text-3xl sm:text-4xl text-ink mt-3">
              {formatDateShort(cycleInfo.nextPeriodDate)}
            </p>
            <span className="mt-3 inline-flex items-center rounded-full bg-accent-300 px-3 py-1 text-sm font-medium text-ink">
              {cycleInfo.daysUntilNextPeriod > 0 ? t('inAboutDays', { n: cycleInfo.daysUntilNextPeriod }) : t('dueNow')}
            </span>
            <div className="mt-5 grid grid-cols-3 gap-3 border-t border-primary-100 pt-5">
              <Stat label={t('currentCycleLength')} value={`${cycleInfo.cycleLength} d`} />
              <Stat label={t('averageCycleLength')} value={`${profile?.cycle_length || 28} d`} />
              <Stat label={t('periodDuration')} value={`${cycleInfo.periodDuration} d`} />
            </div>
            <button
              onClick={() => onNavigate('history')}
              className="mt-5 flex items-center gap-1 text-sm font-medium text-primary-700 hover:text-primary-800"
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
            <p className="rounded-2xl bg-accent-100 px-4 py-3 text-sm text-ink-muted text-center">
              {t('logFewMoreCycles')}
            </p>
          )}
        </>
      ) : (
        <section className="card p-6">
          <div className="flex items-center gap-3 mb-2">
            <Droplet className="text-primary-600" size={22} />
            <h2 className="font-serif text-lg text-ink">{t('welcomeToFemcare')}</h2>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">{t('startByLogging')}</p>
          <button onClick={() => onNavigate('log-period')} className="btn-primary mt-5 flex items-center gap-2">
            <CalendarPlus size={18} />
            {t('logPeriod')}
          </button>
        </section>
      )}

      {/* Quick actions */}
      <section>
        <h3 className="section-title mb-3">{t('quickActions')}</h3>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <QuickAction icon={CalendarPlus} label={t('logPeriod')} onClick={() => onNavigate('log-period')} tone="primary" />
          <QuickAction icon={Activity} label={t('logSymptoms')} onClick={() => onNavigate('symptoms')} tone="accent" />
          <QuickAction icon={Siren} label={t('sos')} onClick={() => onNavChange('sos')} tone="error" />
          <QuickAction icon={MapPin} label={t('findPads')} onClick={() => onNavigate('locator')} tone="success" />
          <QuickAction icon={ShieldCheck} label={t('leaveGuide')} onClick={() => onNavigate('leave-guide')} tone="primary" />
          <QuickAction icon={MessageCircle} label={t('askAI')} onClick={() => onNavigate('chat')} tone="warning" />
        </div>
      </section>

      {/* Daily check-in */}
      <section className="card p-6">
        <h3 className="section-title">{t('todaysCheckin')}</h3>
        <p className="text-sm text-ink-muted mt-1 mb-5">{t('trackHowYouFeel')}</p>

        <div className="flex flex-wrap gap-2 mb-6">
          {MOODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMood(mood === m.key ? '' : m.key)}
              aria-pressed={mood === m.key}
              className={`chip ${
                mood === m.key
                  ? 'bg-primary-100 text-ink ring-2 ring-primary-400'
                  : 'bg-white text-ink-muted ring-1 ring-primary-100'
              }`}
            >
              <span className="text-lg">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>

        <p className="label-text">{t('symptoms')}</p>
        <div className="flex flex-wrap gap-2 mb-6">
          {[...PHYSICAL_SYMPTOMS.slice(0, 5), ...EMOTIONAL_SYMPTOMS.slice(0, 3)].map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              aria-pressed={symptoms.includes(s)}
              className={`chip text-xs ${
                symptoms.includes(s)
                  ? 'bg-primary-500 text-ink'
                  : 'bg-white text-ink-muted ring-1 ring-primary-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mb-6">
          <label htmlFor="pain-level" className="label-text">
            {t('painLevel')}: <span className="font-semibold text-primary-700">{painLevel}/10</span>
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
          <div className="flex justify-between text-xs text-ink-muted mt-1">
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

        <button onClick={saveCheckIn} disabled={savingLog} className="btn-primary w-full flex items-center justify-center gap-2">
          {savingLog ? t('saving') : logSaved ? t('saved') : t('save')}
        </button>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-muted truncate">{label}</p>
      <p className="font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}

function CycleRing({ day, total }: { day: number; total: number }) {
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const progress = Math.min(day / Math.max(total, 1), 1);

  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden="true">
        <circle cx="40" cy="40" r={r} fill="none" stroke="#F4DCE5" strokeWidth="5" />
        <circle
          cx="40"
          cy="40"
          r={r}
          fill="none"
          stroke="#B8A1D9"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-serif text-xl text-ink">{day}</span>
      </div>
    </div>
  );
}

const TONES: Record<string, string> = {
  primary: 'bg-primary-100 text-primary-700',
  accent: 'bg-accent-300 text-ink',
  success: 'bg-success-200 text-success-700',
  error: 'bg-error-100 text-error-600',
  warning: 'bg-warning-100 text-warning-600',
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
      className="card flex flex-col items-center gap-2.5 p-3 sm:p-4 transition-all hover:shadow-lift focus:outline-none focus:ring-2 focus:ring-primary-300"
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-full ${TONES[tone]}`}>
        <Icon size={20} strokeWidth={1.75} />
      </span>
      <span className="text-xs font-medium text-ink text-center leading-snug">{label}</span>
    </button>
  );
}