import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { DailyLog } from '@/lib/types';
import { PHYSICAL_SYMPTOMS, EMOTIONAL_SYMPTOMS, MOODS } from '@/lib/symptoms';
import { Check, Calendar } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { todayStr } from '@/lib/cycle';

export function SymptomsScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [mood, setMood] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [painLevel, setPainLevel] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingLog, setExistingLog] = useState<DailyLog | null>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('log_date', selectedDate)
      .maybeSingle();

    const log = data as DailyLog | null;
    setExistingLog(log);
    if (log) {
      setMood(log.mood || '');
      setSymptoms(log.symptoms || []);
      setPainLevel(log.pain_level || 0);
      setNotes(log.notes || '');
    } else {
      setMood('');
      setSymptoms([]);
      setPainLevel(0);
      setNotes('');
    }
    setLoading(false);
  }, [user, selectedDate]);

  useEffect(() => { loadData(); }, [loadData]);

  function toggleSymptom(s: string) {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  async function save() {
    if (!user) return;
    setSaving(true);

    const logData = {
      user_id: user.id,
      log_date: selectedDate,
      mood,
      symptoms,
      pain_level: painLevel,
      notes,
    };

    if (existingLog) {
      const { error } = await supabase.from('daily_logs').update(logData).eq('id', existingLog.id);
      if (!error) setSaved(true);
    } else {
      const { data, error } = await supabase.from('daily_logs').insert(logData).select().single();
      if (!error && data) setExistingLog(data as DailyLog);
      if (!error) setSaved(true);
    }

    setSaving(false);
    setTimeout(() => setSaved(false), 3000);
  }

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
        <h1 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('logSymptomsTitle')}</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">{t('trackHowYouFeel')}</p>
      </div>

      {/* Date selector */}
      <div className="card p-4">
        <label className="label-text flex items-center gap-2">
          <Calendar size={16} /> {t('date')}
        </label>
        <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} max={todayStr()} className="input-field" />
      </div>

      {/* Mood */}
      <div className="card p-5">
        <h3 className="section-title mb-3">{t('mood')}</h3>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMood(mood === m.key ? '' : m.key)}
              className={`chip ${mood === m.key ? m.color + ' ring-2 ring-primary-400' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-500 dark:text-neutral-400'}`}
            >
              <span className="text-lg">{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Physical symptoms */}
      <div className="card p-5">
        <h3 className="section-title mb-3">{t('physicalSymptoms')}</h3>
        <div className="flex flex-wrap gap-2">
          {PHYSICAL_SYMPTOMS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              className={`chip ${symptoms.includes(s) ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
            >
              {symptoms.includes(s) && <Check size={14} />}
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Emotional symptoms */}
      <div className="card p-5">
        <h3 className="section-title mb-3">{t('emotionalSymptoms')}</h3>
        <div className="flex flex-wrap gap-2">
          {EMOTIONAL_SYMPTOMS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              className={`chip ${symptoms.includes(s) ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
            >
              {symptoms.includes(s) && <Check size={14} />}
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Pain level */}
      <div className="card p-5">
        <h3 className="section-title mb-3">{t('painIntensity')}</h3>
        <div className="flex items-center gap-4">
          <input type="range" min={0} max={10} value={painLevel} onChange={(e) => setPainLevel(Number(e.target.value))} className="flex-1" />
          <span className="text-2xl font-bold text-primary-600 dark:text-primary-400 min-w-[3rem] text-center">{painLevel}</span>
        </div>
        <div className="flex justify-between text-xs text-neutral-400 mt-2">
          <span>{t('noPain')}</span><span>{t('moderate')}</span><span>{t('severe')}</span>
        </div>
      </div>

      {/* Notes */}
      <div className="card p-5">
        <h3 className="section-title mb-3">{t('notes')}</h3>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('anythingElseNote')} rows={3} className="input-field resize-none" />
      </div>

      <button onClick={save} disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
        {saving ? t('saving') : saved ? t('saved') : t('saveSymptoms')}
      </button>
    </div>
  );
}
