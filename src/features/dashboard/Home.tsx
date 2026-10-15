import { useEffect, useState } from 'react';
import {
  Droplet, HeartPulse, Sparkles, MapPin, Siren,
  Moon, Sun, Coffee, Sunset, TrendingUp, Calendar as CalIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme-context';
import { useCycleData } from '@/lib/use-cycle-data';
import { computeCycleInfoML, parseDate, formatDate, type CycleInfo } from '@/lib/cycle';
import { supabase } from '@/lib/supabase';
import { MOODS, PHYSICAL_SYMPTOMS } from '@/lib/types';
import type { PageId } from '@/components/AppShell';
import { Badge } from '@/components/ui';

const moodEmojis: Record<string, string> = {
  Great: ':)', Good: ':)', Okay: ':|', Low: ':(', Difficult: ':(',
};

export default function Home({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const { t } = useTheme();
  const { periods, symptoms, loading, fetchData } = useCycleData(user?.id);
  const [todaySymptoms, setTodaySymptoms] = useState<string[]>([]);
  const [todayMood, setTodayMood] = useState<string>('');
  const [todayPain, setTodayPain] = useState(0);
  const [todayNotes, setTodayNotes] = useState('');
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [checkinSaved, setCheckinSaved] = useState(false);

  const [cycleInfo, setCycleInfo] = useState<CycleInfo | null>(null);

  useEffect(() => {
    if (user) fetchData(user.id);
  }, [user, fetchData]);

  useEffect(() => {
    if (user) {
      computeCycleInfoML(periods, symptoms, profile?.cycle_length || 28, profile?.period_duration || 5, user.id)
        .then(setCycleInfo);
    } else {
      computeCycleInfoML(periods, symptoms, profile?.cycle_length || 28, profile?.period_duration || 5)
        .then(setCycleInfo);
    }
  }, [periods, symptoms, profile, user]);

  useEffect(() => {
    if (user) {
      const today = formatDate(new Date());
      const existing = symptoms.find((s) => s.entry_date === today);
      if (existing) {
        setTodaySymptoms(existing.symptoms || []);
        setTodayMood(existing.mood || '');
        setTodayPain(existing.pain || 0);
        setTodayNotes(existing.notes || '');
      }
    }
  }, [symptoms, user]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('dash.goodMorning') : hour < 17 ? t('dash.goodAfternoon') : t('dash.goodEvening');
  const GreetingIcon = hour < 12 ? Sun : hour < 17 ? Coffee : Sunset;

  const confidenceLabel = cycleInfo?.confidence === 'high' ? 'High' : cycleInfo?.confidence === 'medium' ? 'Medium' : 'Low';
  const confidenceColor = cycleInfo?.confidence === 'high' ? 'success' : cycleInfo?.confidence === 'medium' ? 'warning' : 'error';

  const toggleSymptom = (s: string) => {
    setTodaySymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const handleSaveCheckin = async () => {
    if (!user) return;
    setSavingCheckin(true);
    const today = formatDate(new Date());
    const existing = symptoms.find((s) => s.entry_date === today);

    try {
      if (existing) {
        await supabase.from('symptoms').update({
          symptoms: todaySymptoms,
          mood: todayMood || null,
          pain: todayPain,
          notes: todayNotes || null,
        }).eq('id', existing.id);
      } else {
        await supabase.from('symptoms').insert({
          user_id: user.id,
          entry_date: today,
          symptoms: todaySymptoms,
          mood: todayMood || null,
          pain: todayPain,
          notes: todayNotes || null,
        });
      }
      await fetchData(user.id);
      setCheckinSaved(true);
      setTimeout(() => setCheckinSaved(false), 2000);
    } catch (err) {
      console.error('Save check-in error:', err);
    } finally {
      setSavingCheckin(false);
    }
  };

  const quickActions = [
    { icon: Droplet, label: t('dash.logPeriod'), color: 'bg-primary', onClick: () => onNavigate('calendar') },
    { icon: HeartPulse, label: t('dash.symptoms'), color: 'bg-accent', onClick: () => onNavigate('symptoms') },
    { icon: Sparkles, label: t('dash.askAI'), color: 'bg-success', onClick: () => onNavigate('ai') },
    { icon: MapPin, label: t('dash.findHelp'), color: 'bg-warning', onClick: () => onNavigate('nearby') },
    { icon: Siren, label: t('dash.sos'), color: 'bg-error', onClick: () => onNavigate('sos') },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-pulse text-ink-muted">{t('common.loading')}</div></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <div className="flex items-center gap-2">
        <GreetingIcon size={20} className="text-primary" />
        <h1 className="text-2xl font-bold text-ink dark:text-gray-100">{greeting}, {profile?.name?.split(' ')[0] || 'there'}</h1>
      </div>

      {/* Cycle Status Card */}
      <div className="card bg-gradient-to-br from-primary-50 to-secondary dark:from-primary-900/30 dark:to-bg-card-dark">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm text-ink-muted dark:text-ink-muted-dark mb-1">{t('dash.cycleDay')}</p>
            {cycleInfo?.currentDay ? (
              <p className="text-4xl font-bold text-primary">{cycleInfo.currentDay}</p>
            ) : (
              <p className="text-lg text-ink-muted dark:text-ink-muted-dark">Log a period to start</p>
            )}
          </div>
          <div className="text-right">
            <Badge color={confidenceColor as 'success' | 'warning' | 'error'}>{t('misc.estimate')}</Badge>
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">{t('dash.predictionConfidence')}: {confidenceLabel}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white/60 dark:bg-bg-card-dark/60 rounded-lg p-3">
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">{t('dash.nextPeriod')}</p>
            <p className="text-sm font-semibold text-ink dark:text-gray-100">
              {cycleInfo?.daysUntilNext != null ? `${t('dash.estimatedIn')} ${cycleInfo.daysUntilNext} ${t('dash.days')}` : '—'}
            </p>
          </div>
          <div className="bg-white/60 dark:bg-bg-card-dark/60 rounded-lg p-3">
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">{t('dash.currentPhase')}</p>
            <p className="text-sm font-semibold text-ink dark:text-gray-100">{cycleInfo?.phase || '—'}</p>
          </div>
          <div className="bg-white/60 dark:bg-bg-card-dark/60 rounded-lg p-3">
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">{t('dash.cycleLength')}</p>
            <p className="text-sm font-semibold text-ink dark:text-gray-100">{cycleInfo?.cycleLength ?? '—'} {t('dash.days')}</p>
          </div>
          <div className="bg-white/60 dark:bg-bg-card-dark/60 rounded-lg p-3">
            <p className="text-xs text-ink-muted dark:text-ink-muted-dark">{t('dash.periodDuration')}</p>
            <p className="text-sm font-semibold text-ink dark:text-gray-100">{cycleInfo?.periodDuration ?? '—'} {t('dash.days')}</p>
          </div>
        </div>

        {periods.length === 0 && (
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-4 italic">{t('misc.insufficientData')}</p>
        )}
        {periods.length > 0 && (
          <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-3">{t('misc.estimateDisclaimer')}</p>
        )}
        {cycleInfo?.predictionAccuracy && cycleInfo.predictionAccuracy.avgErrorDays != null && (
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-accent" />
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                Prediction accuracy: {cycleInfo.predictionAccuracy.accuracyPercentage}% (avg error {cycleInfo.predictionAccuracy.avgErrorDays} days, based on {cycleInfo.predictionAccuracy.pastPredictions} past predictions)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="section-title mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.onClick}
                className="card flex flex-col items-center gap-2 hover:shadow-md transition-all active:scale-95"
              >
                <div className={`w-10 h-10 rounded-lg ${action.color} flex items-center justify-center`}>
                  <Icon size={20} className="text-white" />
                </div>
                <span className="text-xs font-medium text-ink dark:text-gray-200 text-center">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Today's Check-in */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">{t('dash.todaysCheckin')}</h2>
          {checkinSaved && <Badge color="success">Saved</Badge>}
        </div>

        <p className="text-sm text-ink-muted dark:text-ink-muted-dark mb-2">{t('dash.howFeeling')}</p>
        <div className="flex gap-2 mb-4">
          {MOODS.map((mood) => (
            <button
              key={mood}
              onClick={() => setTodayMood(todayMood === mood ? '' : mood)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                todayMood === mood
                  ? 'bg-primary text-white'
                  : 'bg-gray-50 dark:bg-gray-800 text-ink dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {mood}
            </button>
          ))}
        </div>

        <p className="text-sm text-ink-muted dark:text-ink-muted-dark mb-2">Symptoms</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {PHYSICAL_SYMPTOMS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              className={`chip ${todaySymptoms.includes(s) ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1">
            <label className="label mb-0">{t('dash.pain')}</label>
            <span className="text-sm font-semibold text-primary">{todayPain}/10</span>
          </div>
          <input
            type="range"
            min={0}
            max={10}
            value={todayPain}
            onChange={(e) => setTodayPain(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>

        <div className="mb-4">
          <label className="label">{t('dash.notes')}</label>
          <textarea
            className="input min-h-[80px] resize-none"
            value={todayNotes}
            onChange={(e) => setTodayNotes(e.target.value)}
            placeholder="Any notes about how you're feeling..."
          />
        </div>

        <button onClick={handleSaveCheckin} className="btn-primary w-full" disabled={savingCheckin}>
          {savingCheckin ? 'Saving...' : t('dash.saveCheckin')}
        </button>
      </div>

      {/* Recent Activity */}
      {periods.length > 0 && (
        <div className="card">
          <h2 className="section-title mb-3">{t('dash.lastLoggedPeriod')}</h2>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
              <CalIcon size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink dark:text-gray-100">
                {new Date(periods[periods.length - 1].start_date).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark">
                {periods[periods.length - 1].end_date
                  ? `Duration: ${Math.round((parseDate(periods[periods.length - 1].end_date!).getTime() - parseDate(periods[periods.length - 1].start_date).getTime()) / 86400000) + 1} days`
                  : 'In progress'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
