import { translateSymptom, translateMood } from '@/lib/symptom-labels';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { DailyLog } from '@/lib/types';
import { PHYSICAL_SYMPTOMS, EMOTIONAL_SYMPTOMS, MOODS } from '@/lib/symptoms';
import { Check, Plus } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { todayStr } from '@/lib/cycle';
import { PageHeader } from '@/components/PageHeader';

const EXTRA_PHYSICAL = ['Joint pain', 'Leg pain', 'Food cravings', 'Constipation', 'Diarrhea', 'Insomnia', 'Spotting', 'Frequent urination', 'Chills'];
const EXTRA_EMOTIONAL = ['Crying spells', 'Anger', 'Low concentration', 'Low motivation', 'Overwhelmed', 'Calm'];
const BASE_PHYSICAL = PHYSICAL_SYMPTOMS as readonly string[];
const BASE_EMOTIONAL = EMOTIONAL_SYMPTOMS as readonly string[];
const PHYSICAL_ALL: string[] = [...BASE_PHYSICAL, ...EXTRA_PHYSICAL.filter((x) => !BASE_PHYSICAL.includes(x))];
const EMOTIONAL_ALL: string[] = [...BASE_EMOTIONAL, ...EXTRA_EMOTIONAL.filter((x) => !BASE_EMOTIONAL.includes(x))];
const KNOWN = new Set<string>([...PHYSICAL_ALL, ...EMOTIONAL_ALL]);

export function SymptomsScreen() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [mood, setMood] = useState('');
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [painLevel, setPainLevel] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [existingLog, setExistingLog] = useState<DailyLog | null>(null);
  const [customInput, setCustomInput] = useState('');
  const [pastCustom, setPastCustom] = useState<string[]>([]);

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

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('daily_logs')
        .select('symptoms')
        .eq('user_id', user.id)
        .order('log_date', { ascending: false })
        .limit(120);
      if (cancelled) return;
      const found: string[] = [];
      ((data as { symptoms: string[] | null }[]) || []).forEach((r) =>
        (r.symptoms || []).forEach((s) => { if (!KNOWN.has(s) && !found.includes(s)) found.push(s); })
      );
      setPastCustom(found.slice(0, 20));
    })();
    return () => { cancelled = true; };
  }, [user]);

  function toggleSymptom(s: string) {
    setSymptoms((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  }

  function addCustom() {
    const v = customInput.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!v) return;
    const match = [...PHYSICAL_ALL, ...EMOTIONAL_ALL, ...pastCustom].find((x) => x.toLowerCase() === v.toLowerCase());
    const val = match ?? v;
    setSymptoms((prev) => (prev.includes(val) ? prev : [...prev, val]));
    setCustomInput('');
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
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const chipOff = 'bg-bg-card text-ink-muted ring-1 ring-primary-100 dark:ring-white/15';
  const chipOn = 'bg-primary-500 text-ink-onlight';
  const customSymptoms = [...pastCustom, ...symptoms.filter((s) => !KNOWN.has(s) && !pastCustom.includes(s))];

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title={t('logSymptomsTitle')} subtitle={t('trackHowYouFeel')} art="bloom">
        <input
          type="date"
          aria-label={t('date')}
          value={selectedDate}
          onChange={(e) => setSelectedDate(e.target.value)}
          max={todayStr()}
          className="input-field"
        />
      </PageHeader>

      {/* Mood */}
      <section className="card p-5">
        <h3 className="section-title mb-3">{t('mood')}</h3>
        <div className="flex flex-wrap gap-2">
          {MOODS.map((m) => (
            <button
              key={m.key}
              onClick={() => setMood(mood === m.key ? '' : m.key)}
              aria-pressed={mood === m.key}
              className={`chip ${
                mood === m.key
                  ? 'bg-primary-100 text-ink ring-2 ring-primary-400 dark:bg-primary-900/50'
                  : chipOff
              }`}
            >
              <span className="text-lg">{m.emoji}</span>
              {translateMood(m.key, lang)}
            </button>
          ))}
        </div>
      </section>

      {/* Symptoms */}
      <section className="card p-5">
        <h3 className="section-title mb-4">{t('symptoms')}</h3>

        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">{t('physicalSymptoms')}</p>
        <div className="mb-5 flex flex-wrap gap-2">
          {PHYSICAL_ALL.map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              aria-pressed={symptoms.includes(s)}
              className={`chip ${symptoms.includes(s) ? chipOn : chipOff}`}
            >
              {symptoms.includes(s) && <Check size={14} />}
              {translateSymptom(s, lang)}
            </button>
          ))}
        </div>

        <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">{t('emotionalSymptoms')}</p>
        <div className="flex flex-wrap gap-2">
          {EMOTIONAL_ALL.map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              aria-pressed={symptoms.includes(s)}
              className={`chip ${symptoms.includes(s) ? chipOn : chipOff}`}
            >
              {symptoms.includes(s) && <Check size={14} />}
              {translateSymptom(s, lang)}
            </button>
          ))}
        </div>
        <p className="mb-2 mt-5 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">{t('symOwnHeading')}</p>
        {customSymptoms.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {customSymptoms.map((s) => (
              <button
                key={s}
                onClick={() => toggleSymptom(s)}
                aria-pressed={symptoms.includes(s)}
                className={`chip ${symptoms.includes(s) ? chipOn : chipOff}`}
              >
                {symptoms.includes(s) && <Check size={14} />}
                {translateSymptom(s, lang)}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="text"
            value={customInput}
            maxLength={40}
            onChange={(e) => setCustomInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            placeholder={t('symOwnPlaceholder')}
            aria-label="Add your own symptom"
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!customInput.trim()}
            aria-label="Add symptom"
            className="btn-primary flex items-center justify-center !px-4"
          >
            <Plus size={18} />
          </button>
        </div>
      </section>

      {/* Pain and notes */}
      <section className="card p-5">
        <h3 className="section-title mb-3">{t('painIntensity')}</h3>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={10}
            value={painLevel}
            onChange={(e) => setPainLevel(Number(e.target.value))}
            aria-label={t('painIntensity')}
            className="flex-1"
          />
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-100 font-serif text-xl text-primary-800 dark:bg-primary-900/50 dark:text-primary-200">
            {painLevel}
          </span>
        </div>
        <div className="mt-2 flex justify-between text-xs text-ink-muted">
          <span>{t('noPain')}</span>
          <span>{t('moderate')}</span>
          <span>{t('severe')}</span>
        </div>

        <div className="mt-5 border-t border-primary-100 pt-5 dark:border-white/10">
          <label htmlFor="symptom-notes" className="label-text">
            {t('notes')} <span className="font-normal text-ink-muted">({t('optional')})</span>
          </label>
          <textarea
            id="symptom-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('anythingElseNote')}
            rows={3}
            className="input-field resize-none"
          />
        </div>
      </section>

      <button onClick={save} disabled={saving} className="btn-primary flex w-full items-center justify-center gap-2">
        {saving ? t('saving') : saved ? t('saved') : t('saveSymptoms')}
      </button>
    </div>
  );
}