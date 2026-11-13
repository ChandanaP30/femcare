import { translateSymptom } from '@/lib/symptom-labels';
import { PHYSICAL_SYMPTOMS, EMOTIONAL_SYMPTOMS } from '@/lib/symptoms';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useLanguage } from '@/lib/language-context';
import { supabase } from '@/lib/supabase';
import type { Period, PeriodDayLog, FlowLevel } from '@/lib/types';
import { parseDate, addDays, daysBetween, formatDateShort, todayStr, toDateStr } from '@/lib/cycle';
import { ChevronLeft, ChevronRight, Trash2, Check, Droplet, X } from 'lucide-react';

interface DayDetail {
  flow_level: FlowLevel | null;
  mood: string;
  symptoms: string[];
  pain_level: number;
  notes: string;
}

const FLOW_OPTIONS: { key: FlowLevel; labelKey: 'flowLight' | 'flowMedium' | 'flowHeavy' }[] = [
  { key: 'light', labelKey: 'flowLight' },
  { key: 'medium', labelKey: 'flowMedium' },
  { key: 'heavy', labelKey: 'flowHeavy' },
];

const MOOD_OPTIONS = [
  { key: 'happy', emoji: '😄', labelKey: 'happy' as const },
  { key: 'good', emoji: '😊', labelKey: 'good' as const },
  { key: 'neutral', emoji: '😐', labelKey: 'neutral' as const },
  { key: 'low', emoji: '😔', labelKey: 'low' as const },
  { key: 'difficult', emoji: '😣', labelKey: 'difficult' as const },
  { key: 'irritable', emoji: '😤', labelKey: 'irritable' as const },
];

const SYMPTOM_OPTIONS: readonly string[] = [...PHYSICAL_SYMPTOMS, ...EMOTIONAL_SYMPTOMS];

export function PeriodLogScreen({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { profile, user } = useAuth();
  const { t, lang } = useLanguage();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [startDate, setStartDate] = useState(todayStr());
  const [endDate, setEndDate] = useState('');
  const [overallFlow, setOverallFlow] = useState<FlowLevel | null>(null);
  const [periodNotes, setPeriodNotes] = useState('');
  const [customSymptom, setCustomSymptom] = useState('');
  function addCustomSymptom() {
    const v = customSymptom.trim();
    if (!v || !activeDayDate) return;
    const cur = getDayDetail(activeDayDate);
    if (!cur.symptoms.some((s) => s.toLowerCase() === v.toLowerCase())) {
      updateDayDetail(activeDayDate, { symptoms: [...cur.symptoms, v] });
    }
    setCustomSymptom('');
  }
  const [dayDetails, setDayDetails] = useState<Record<string, DayDetail>>({});
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [activeDayIndex, setActiveDayIndex] = useState<number>(0);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('periods')
      .select('*')
      .eq('user_id', user.id)
      .order('start_date', { ascending: false });
    setPeriods((data as Period[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  // Compute the days in the period
  const startD = parseDate(startDate);
  const endD = endDate ? parseDate(endDate) : null;
  const numDays = startD && endD ? Math.max(1, daysBetween(startD, endD) + 1) : startD ? 1 : 0;
  const dayDates: string[] = [];
  if (startD) {
    const count = Math.max(1, numDays);
    for (let i = 0; i < count; i++) {
      dayDates.push(toDateStr(addDays(startD, i)));
    }
  }

  function getDayDetail(dateStr: string): DayDetail {
    return dayDetails[dateStr] || { flow_level: null, mood: '', symptoms: [], pain_level: 0, notes: '' };
  }

  function updateDayDetail(dateStr: string, updates: Partial<DayDetail>) {
    setDayDetails((prev) => ({
      ...prev,
      [dateStr]: { ...getDayDetail(dateStr), ...updates },
    }));
  }

  function toggleSymptom(dateStr: string, symptomKey: string) {
    const detail = getDayDetail(dateStr);
    const translated = t(symptomKey as never);
    const current = detail.symptoms;
    updateDayDetail(dateStr, {
      symptoms: current.includes(translated) ? current.filter((s) => s !== translated) : [...current, translated],
    });
  }

  async function savePeriod() {
    if (!user || !startDate) return;
    setSaving(true);

    const periodData: Record<string, unknown> = {
      user_id: user.id,
      start_date: startDate,
      end_date: endDate || null,
      notes: periodNotes,
      flow_level: overallFlow,
    };

    let periodId: string;

    if (editingPeriodId) {
      const { error } = await supabase.from('periods').update(periodData).eq('id', editingPeriodId);
      if (error) { setSaving(false); return; }
      periodId = editingPeriodId;
      // Delete old day logs for this period
      await supabase.from('period_day_logs').delete().eq('period_id', periodId);
    } else {
      const { data, error } = await supabase.from('periods').insert(periodData).select().single();
      if (error) { setSaving(false); return; }
      periodId = (data as Period).id;
    }

    // Save day logs
    const dayLogsToInsert = dayDates
      .filter((ds) => {
        const d = getDayDetail(ds);
        return d.flow_level || d.mood || d.symptoms.length > 0 || d.pain_level > 0 || d.notes;
      })
      .map((ds) => ({
        user_id: user.id,
        period_id: periodId,
        log_date: ds,
        flow_level: getDayDetail(ds).flow_level,
        mood: getDayDetail(ds).mood,
        symptoms: getDayDetail(ds).symptoms,
        pain_level: getDayDetail(ds).pain_level,
        notes: getDayDetail(ds).notes,
      }));

    if (dayLogsToInsert.length > 0) {
      await supabase.from('period_day_logs').insert(dayLogsToInsert);
    }

    // Update profile last_period_date
    if (profile) {
      await supabase.from('profiles').update({ last_period_date: startDate }).eq('id', user.id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onNavigate('history');
    }, 1500);
  }

  async function deletePeriodLog() {
    if (!editingPeriodId || !user) return;
    if (!confirm(t('deletePeriodConfirm'))) return;
    await supabase.from('periods').delete().eq('id', editingPeriodId);
    onNavigate('history');
  }

  function loadExistingPeriod(period: Period) {
    setEditingPeriodId(period.id);
    setStartDate(period.start_date);
    setEndDate(period.end_date || '');
    setOverallFlow(period.flow_level);
    setPeriodNotes(period.notes || '');

    // Load day logs
    if (user) {
      supabase
        .from('period_day_logs')
        .select('*')
        .eq('period_id', period.id)
        .then(({ data }) => {
          const logs = (data as PeriodDayLog[]) || [];
          const details: Record<string, DayDetail> = {};
          for (const log of logs) {
            details[log.log_date] = {
              flow_level: log.flow_level,
              mood: log.mood,
              symptoms: log.symptoms || [],
              pain_level: log.pain_level || 0,
              notes: log.notes || '',
            };
          }
          setDayDetails(details);
        });
    }
  }

  function resetForm() {
    setEditingPeriodId(null);
    setStartDate(todayStr());
    setEndDate('');
    setOverallFlow(null);
    setPeriodNotes('');
    setDayDetails({});
    setActiveDayIndex(0);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const activeDayDate = dayDates[activeDayIndex];
  const activeDetail = activeDayDate ? getDayDetail(activeDayDate) : null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => onNavigate('home')} className="p-2 -ml-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300">
          <ChevronLeft size={22} />
        </button>
        <div>
          <h1 className="font-serif text-xl font-bold text-neutral-900 dark:text-neutral-100">{t('detailedPeriodLogging')}</h1>
        </div>
      </div>

      {/* Edit existing periods */}
      {periods.length > 0 && !editingPeriodId && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">{t('editDeletePeriod')}</p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {periods.slice(0, 5).map((p) => (
              <button
                key={p.id}
                onClick={() => loadExistingPeriod(p)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-neutral-50 dark:bg-neutral-700/30 hover:bg-neutral-100 dark:hover:bg-neutral-700/50 transition-colors text-left"
              >
                <span className="text-sm text-neutral-700 dark:text-neutral-300">
                  {formatDateShort(p.start_date)}{p.end_date ? ` → ${formatDateShort(p.end_date)}` : ''}
                </span>
                <ChevronRight size={14} className="text-neutral-400" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Date range */}
      <div className="card p-5 space-y-4">
        <div>
          <label className="label-text">{t('periodStartDate')}</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setActiveDayIndex(0); }}
            max={todayStr()}
            className="input-field"
          />
        </div>
        <div>
          <label className="label-text">{t('periodEndDate')} <span className="text-neutral-400 font-normal">({t('optional')})</span></label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setActiveDayIndex(0); }}
            min={startDate}
            max={todayStr()}
            className="input-field"
          />
        </div>
        <div>
          <label className="label-text">{t('overallFlow')}</label>
          <div className="flex gap-2 mt-1">
            {FLOW_OPTIONS.map((f) => (
              <button
                key={f.key}
                onClick={() => setOverallFlow(overallFlow === f.key ? null : f.key)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  overallFlow === f.key
                    ? f.key === 'light' ? 'bg-success-500 text-white' : f.key === 'medium' ? 'bg-warning-500 text-white' : 'bg-error-500 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {t(f.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Day-by-day details */}
      {dayDates.length > 0 && (
        <div className="card p-5">
          <h3 className="section-title mb-4 flex items-center gap-2">
            <Droplet size={16} className="text-primary-500" />
            {t('dayByDay')}
          </h3>

          {/* Day tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
            {dayDates.map((ds, i) => {
              const d = getDayDetail(ds);
              const hasData = d.flow_level || d.mood || d.symptoms.length > 0 || d.pain_level > 0 || d.notes;
              return (
                <button
                  key={ds}
                  onClick={() => setActiveDayIndex(i)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                    activeDayIndex === i
                      ? 'bg-primary-500 text-white'
                      : hasData
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                      : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-500 dark:text-neutral-400'
                  }`}
                >
                  {t(`day${((i % 7) + 1)}` as 'day1')}
                  {hasData && activeDayIndex !== i && <Check size={12} className="inline ml-1" />}
                </button>
              );
            })}
          </div>

          {/* Active day editor */}
          {activeDetail && activeDayDate && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">{formatDateShort(activeDayDate)}</p>

              {/* Flow */}
              <div>
                <label className="label-text">{t('bloodFlow')}</label>
                <div className="flex gap-2">
                  {FLOW_OPTIONS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => updateDayDetail(activeDayDate, { flow_level: activeDetail.flow_level === f.key ? null : f.key })}
                      className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
                        activeDetail.flow_level === f.key
                          ? f.key === 'light' ? 'bg-success-500 text-white' : f.key === 'medium' ? 'bg-warning-500 text-white' : 'bg-error-500 text-white'
                          : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'
                      }`}
                    >
                      {t(f.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Pain */}
              <div>
                <label className="label-text">{t('painCrampsLevel')}: <span className="text-primary-600 dark:text-primary-400 font-semibold">{activeDetail.pain_level}/10</span></label>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={activeDetail.pain_level}
                  onChange={(e) => updateDayDetail(activeDayDate, { pain_level: Number(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-neutral-400 mt-1">
                  <span>{t('noPain')}</span><span>{t('severe')}</span>
                </div>
              </div>

              {/* Mood */}
              <div>
                <label className="label-text">{t('selectMood')}</label>
                <div className="flex flex-wrap gap-2">
                  {MOOD_OPTIONS.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => updateDayDetail(activeDayDate, { mood: activeDetail.mood === m.key ? '' : m.key })}
                      className={`chip text-xs ${activeDetail.mood === m.key ? 'bg-primary-500 text-white ring-2 ring-primary-400' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
                    >
                      <span className="text-base">{m.emoji}</span>
                      {t(m.labelKey)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Symptoms */}
              <div>
                <label className="label-text">{t('selectSymptoms')}</label>
                <p className="mt-1 mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('physicalSymptomsHeading')}</p>
                <div className="flex flex-wrap gap-2">
                  {PHYSICAL_SYMPTOMS.map((sKey) => {
                    const translated = translateSymptom(sKey, lang);
                    const selected = activeDetail.symptoms.includes(translated);
                    return (
                      <button
                        key={sKey}
                        onClick={() => toggleSymptom(activeDayDate, sKey)}
                        className={`chip text-xs ${selected ? 'bg-accent-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
                      >
                        {selected && <Check size={12} />}
                        {translated}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">{t('emotionalSymptomsHeading')}</p>
                <div className="flex flex-wrap gap-2">
                  {EMOTIONAL_SYMPTOMS.map((sKey) => {
                    const translated = translateSymptom(sKey, lang);
                    const selected = activeDetail.symptoms.includes(translated);
                    return (
                      <button
                        key={sKey}
                        onClick={() => toggleSymptom(activeDayDate, sKey)}
                        className={`chip text-xs ${selected ? 'bg-accent-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
                      >
                        {selected && <Check size={12} />}
                        {translated}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={customSymptom}
                    onChange={(e) => setCustomSymptom(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSymptom(); } }}
                    placeholder={t('typeYourOwnSymptom')}
                    className="input-field flex-1"
                    maxLength={60}
                  />
                  <button type="button" onClick={addCustomSymptom} disabled={!customSymptom.trim()} className="btn-primary px-4 text-sm">{t('add')}</button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="label-text">{t('dayNotes')} <span className="text-neutral-400 font-normal">({t('optional')})</span></label>
                <textarea
                  value={activeDetail.notes}
                  onChange={(e) => updateDayDetail(activeDayDate, { notes: e.target.value })}
                  placeholder={t('addNotes')}
                  rows={2}
                  className="input-field resize-none"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {editingPeriodId && (
          <button onClick={deletePeriodLog} className="btn-ghost text-error-600 dark:text-error-400 flex items-center gap-2">
            <Trash2 size={18} />
            {t('delete')}
          </button>
        )}
        <button onClick={resetForm} className="btn-ghost flex items-center gap-2">
          <X size={18} />
          {t('cancel')}
        </button>
        <button onClick={savePeriod} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
          {saving ? t('saving') : saved ? t('periodSaved') : t('savePeriod')}
        </button>
      </div>
    </div>
  );
}
