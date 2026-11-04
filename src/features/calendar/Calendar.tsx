import { translateSymptom, translateMood } from '@/lib/symptom-labels';
import { getLangCode } from '@/lib/lang-store';
import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Droplet, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useCycleData } from '@/lib/use-cycle-data';
import { computeCycleInfoML, parseDate, formatDate, addDays, daysBetween, type CycleInfo } from '@/lib/cycle';
import { supabase } from '@/lib/supabase';
import { Modal, Badge } from '@/components/ui';
import type { Period } from '@/lib/types';
import { PHYSICAL_SYMPTOMS, EMOTIONAL_SYMPTOMS, MOODS, BLOOD_FLOW_LEVELS } from '@/lib/types';

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function Calendar() {
  const { user, profile } = useAuth();
  const { periods, symptoms, loading, fetchData } = useCycleData(user?.id);
  const [viewDate, setViewDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPeriodStart, setNewPeriodStart] = useState(formatDate(new Date()));
  const [newPeriodEnd, setNewPeriodEnd] = useState('');
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [saving, setSaving] = useState(false);
  const [logSymptoms, setLogSymptoms] = useState<string[]>([]);
  const [logMood, setLogMood] = useState('');
  const [logBloodFlow, setLogBloodFlow] = useState('');
  const [logPain, setLogPain] = useState(0);
  const [logNotes, setLogNotes] = useState('');

  useEffect(() => {
    if (user) fetchData(user.id);
  }, [user, fetchData]);

  const [cycleInfo, setCycleInfo] = useState<CycleInfo | null>(null);

  useEffect(() => {
    computeCycleInfoML(periods, symptoms, profile?.cycle_length || 28, profile?.period_duration || 5, user?.id)
      .then(setCycleInfo);
  }, [periods, symptoms, profile, user]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startWeekday = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const periodDates = useMemo(() => {
    const dates = new Set<string>();
    periods.forEach((p) => {
      if (!p.end_date) {
        dates.add(p.start_date);
      } else {
        const start = parseDate(p.start_date);
        const end = parseDate(p.end_date);
        let d = start;
        while (d <= end) {
          dates.add(formatDate(d));
          d = addDays(d, 1);
        }
      }
    });
    return dates;
  }, [periods]);

  const predictedDates = useMemo(() => {
    const dates = new Set<string>();
    if (cycleInfo?.periodWindowStart && cycleInfo?.periodWindowEnd) {
      const start = parseDate(cycleInfo.periodWindowStart);
      const end = parseDate(cycleInfo.periodWindowEnd);
      let d = start;
      while (d <= end) {
        if (!periodDates.has(formatDate(d))) dates.add(formatDate(d));
        d = addDays(d, 1);
      }
    }
    return dates;
  }, [cycleInfo, periodDates]);

  const fertileDates = useMemo(() => {
    const dates = new Set<string>();
    if (cycleInfo?.fertileWindowStart && cycleInfo?.fertileWindowEnd) {
      const start = parseDate(cycleInfo.fertileWindowStart);
      const end = parseDate(cycleInfo.fertileWindowEnd);
      let d = start;
      while (d <= end) {
        dates.add(formatDate(d));
        d = addDays(d, 1);
      }
    }
    return dates;
  }, [cycleInfo]);

  const ovulationDate = cycleInfo?.ovulationDate;

  const symptomDates = useMemo(() => {
    const map = new Map<string, { symptoms: string[]; mood: string | null; pain: number }>();
    symptoms.forEach((s) => {
      map.set(s.entry_date, { symptoms: s.symptoms || [], mood: s.mood, pain: s.pain });
    });
    return map;
  }, [symptoms]);

  const today = formatDate(new Date());

  const getDayState = (dateStr: string) => {
    if (periodDates.has(dateStr)) return 'period';
    if (predictedDates.has(dateStr)) return 'predicted';
    if (dateStr === ovulationDate) return 'ovulation';
    if (fertileDates.has(dateStr)) return 'fertile';
    if (symptomDates.has(dateStr)) return 'symptom';
    return 'none';
  };

  const toggleLogSymptom = (s: string) => {
    setLogSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const resetLogFields = () => {
    setLogSymptoms([]);
    setLogMood('');
    setLogBloodFlow('');
    setLogPain(0);
    setLogNotes('');
  };

  const handleSavePeriod = async () => {
    if (!user || !newPeriodStart) return;
    setSaving(true);
    try {
      const duration = newPeriodEnd ? daysBetween(parseDate(newPeriodStart), parseDate(newPeriodEnd)) + 1 : null;
      let periodId = editingPeriod?.id;

      if (editingPeriod) {
        await supabase.from('periods').update({
          start_date: newPeriodStart,
          end_date: newPeriodEnd || null,
          duration,
          blood_flow: logBloodFlow || null,
        }).eq('id', editingPeriod.id);
      } else {
        const { data: newPeriod } = await supabase.from('periods').insert({
          user_id: user.id,
          start_date: newPeriodStart,
          end_date: newPeriodEnd || null,
          duration,
          blood_flow: logBloodFlow || null,
        }).select().single();
        periodId = newPeriod?.id;
      }

      if (logSymptoms.length > 0 || logMood || logPain > 0 || logNotes) {
        const symptomDate = newPeriodStart;
        const { data: existing } = await supabase
          .from('symptoms')
          .select('id')
          .eq('user_id', user.id)
          .eq('entry_date', symptomDate)
          .maybeSingle();

        if (existing) {
          await supabase.from('symptoms').update({
            symptoms: logSymptoms,
            mood: logMood || null,
            pain: logPain,
            notes: logNotes || null,
          }).eq('id', existing.id);
        } else {
          await supabase.from('symptoms').insert({
            user_id: user.id,
            entry_date: symptomDate,
            symptoms: logSymptoms,
            mood: logMood || null,
            pain: logPain,
            notes: logNotes || null,
          });
        }
      }

      await fetchData(user.id);
      setShowAddModal(false);
      setEditingPeriod(null);
      setNewPeriodStart(formatDate(new Date()));
      setNewPeriodEnd('');
      resetLogFields();
    } catch (err) {
      console.error('Save period error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePeriod = async (id: string) => {
    if (!user) return;
    await supabase.from('periods').delete().eq('id', id);
    await fetchData(user.id);
    setSelectedDate(null);
  };

  const handleEndPeriod = async (p: Period) => {
    if (!user) return;
    const today = formatDate(new Date());
    const duration = daysBetween(parseDate(p.start_date), parseDate(today)) + 1;
    await supabase.from('periods').update({ end_date: today, duration }).eq('id', p.id);
    await fetchData(user.id);
    setSelectedDate(null);
  };

  const selectedPeriod = selectedDate ? periods.find((p) => p.start_date === selectedDate || (p.end_date && selectedDate >= p.start_date && selectedDate <= p.end_date)) : null;
  const selectedSymptomData = selectedDate ? symptomDates.get(selectedDate) : undefined;

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Calendar</h1>
        <button onClick={() => { setEditingPeriod(null); setShowAddModal(true); }} className="btn-primary">
          <Droplet size={18} /> Log Period
        </button>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-primary" /> Logged period</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-primary-200" /> Predicted period</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-accent" /> Fertile window</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-warning" /> Ovulation</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-success" /> Symptoms</div>
      </div>

      {/* Calendar */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setViewDate(new Date(year, month - 1, 1))} className="btn-ghost p-2">
            <ChevronLeft size={20} />
          </button>
          <h2 className="font-semibold text-ink dark:text-gray-100">{MONTHS[month]} {year}</h2>
          <button onClick={() => setViewDate(new Date(year, month + 1, 1))} className="btn-ghost p-2">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="text-center text-xs font-medium text-ink-muted dark:text-ink-muted-dark py-1">{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dateStr = formatDate(new Date(year, month, day));
            const state = getDayState(dateStr);
            const isToday = dateStr === today;

            const bgClass = {
              period: 'bg-primary text-white',
              predicted: 'bg-primary-200 dark:bg-primary-800 text-primary-700 dark:text-primary-200',
              ovulation: 'bg-warning text-white',
              fertile: 'bg-accent-100 dark:bg-accent-900/40 text-accent-500',
              symptom: 'bg-success-50 dark:bg-success-900/30 text-success-600',
              none: 'hover:bg-gray-50 dark:hover:bg-gray-800 text-ink dark:text-gray-200',
            }[state];

            return (
              <button
                key={i}
                onClick={() => setSelectedDate(dateStr)}
                className={`aspect-square rounded-lg text-sm font-medium transition-all relative ${bgClass} ${isToday ? 'ring-2 ring-primary ring-offset-1 dark:ring-offset-bg-card-dark' : ''}`}
              >
                {day}
                {state === 'symptom' && <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-success" />}
              </button>
            );
          })}
        </div>
      </div>

      {periods.length === 0 && (
        <p className="text-sm text-ink-muted dark:text-ink-muted-dark italic text-center">{`Not enough personal data yet. Keep logging your cycles to improve your personal estimates.`}</p>
      )}
      {periods.length > 0 && (
        <p className="text-xs text-ink-muted dark:text-ink-muted-dark text-center">Cycle predictions are estimates and may be less reliable when cycles are irregular or when limited data is available.</p>
      )}

      {/* Date Detail Modal */}
      <Modal open={!!selectedDate} onClose={() => setSelectedDate(null)} title={selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString(getLangCode(), { weekday: 'long', day: 'numeric', month: 'long' }) : ''}>
        {selectedDate && (
          <div className="space-y-4">
            {selectedPeriod ? (
              <div className="space-y-3">
                <Badge color="primary">Logged period</Badge>
                <p className="text-sm text-ink dark:text-gray-200">
                  Started: {new Date(selectedPeriod.start_date + 'T00:00:00').toLocaleDateString(getLangCode(), { day: 'numeric', month: 'short' })}
                </p>
                {selectedPeriod.end_date && (
                  <p className="text-sm text-ink dark:text-gray-200">
                    Ended: {new Date(selectedPeriod.end_date + 'T00:00:00').toLocaleDateString(getLangCode(), { day: 'numeric', month: 'short' })}
                  </p>
                )}
                {selectedPeriod.blood_flow && (
                  <div className="flex items-center gap-2">
                    <Droplet size={14} className="text-primary" />
                    <span className="text-sm text-ink dark:text-gray-200">Flow: {selectedPeriod.blood_flow}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  {!selectedPeriod.end_date && (
                    <button onClick={() => handleEndPeriod(selectedPeriod)} className="btn-secondary text-sm">End Period</button>
                  )}
                  <button onClick={() => { setEditingPeriod(selectedPeriod); setNewPeriodStart(selectedPeriod.start_date); setNewPeriodEnd(selectedPeriod.end_date || ''); setLogBloodFlow(selectedPeriod.blood_flow || ''); setShowAddModal(true); setSelectedDate(null); }} className="btn-outline text-sm">Edit</button>
                  <button onClick={() => handleDeletePeriod(selectedPeriod.id)} className="btn-danger text-sm">Delete</button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark">No period logged for this date.</p>
            )}

            {selectedSymptomData && (selectedSymptomData.symptoms.length > 0 || selectedSymptomData.mood || selectedSymptomData.pain > 0) && (
              <div className="space-y-2">
                {selectedSymptomData.symptoms.length > 0 && (
                  <div>
                    <p className="text-sm font-medium text-ink dark:text-gray-100 mb-2">Symptoms logged:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedSymptomData.symptoms.map((s) => (
                        <Badge key={s} color="success">{translateSymptom(s, lang)}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSymptomData.mood && (
                  <p className="text-sm text-ink dark:text-gray-200">Mood: {selectedSymptomData.mood}</p>
                )}
                {selectedSymptomData.pain > 0 && (
                  <p className="text-sm text-ink dark:text-gray-200">Pain: {selectedSymptomData.pain}/10</p>
                )}
              </div>
            )}

            <button onClick={() => { setEditingPeriod(null); setNewPeriodStart(selectedDate); setNewPeriodEnd(''); setShowAddModal(true); setSelectedDate(null); }} className="btn-primary w-full text-sm">
              Log period for this date
            </button>
          </div>
        )}
      </Modal>

      {/* Add/Edit Period Modal */}
      <Modal open={showAddModal} onClose={() => setShowAddModal(false)} title={editingPeriod ? 'Edit Period' : 'Log Period'}>
        <div className="space-y-5">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Start date</label>
              <input type="date" className="input" value={newPeriodStart} onChange={(e) => setNewPeriodStart(e.target.value)} max={today} />
            </div>
            <div>
              <label className="label">End date (optional)</label>
              <input type="date" className="input" value={newPeriodEnd} onChange={(e) => setNewPeriodEnd(e.target.value)} min={newPeriodStart} max={today} />
            </div>
          </div>

          {/* Blood Flow */}
          <div>
            <label className="label">Blood flow</label>
            <div className="flex gap-2">
              {BLOOD_FLOW_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setLogBloodFlow(logBloodFlow === level ? '' : level)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    logBloodFlow === level
                      ? 'bg-primary text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-ink dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          {/* Mood */}
          <div>
            <label className="label">Mood</label>
            <div className="flex gap-2">
              {MOODS.map((mood) => (
                <button
                  key={mood}
                  onClick={() => setLogMood(logMood === mood ? '' : mood)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    logMood === mood
                      ? 'bg-accent text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-ink dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>

          {/* Pain */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Pain level</label>
              <span className="text-sm font-semibold text-primary">{logPain}/10</span>
            </div>
            <input
              type="range"
              min={0}
              max={10}
              value={logPain}
              onChange={(e) => setLogPain(Number(e.target.value))}
              className="w-full accent-primary"
            />
          </div>

          {/* Physical Symptoms */}
          <div>
            <label className="label">Physical symptoms</label>
            <div className="flex flex-wrap gap-2">
              {PHYSICAL_SYMPTOMS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleLogSymptom(s)}
                  className={`chip ${logSymptoms.includes(s) ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
                >
                  {translateSymptom(s, lang)}
                </button>
              ))}
            </div>
          </div>

          {/* Emotional Symptoms */}
          <div>
            <label className="label">Emotional symptoms</label>
            <div className="flex flex-wrap gap-2">
              {EMOTIONAL_SYMPTOMS.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleLogSymptom(s)}
                  className={`chip ${logSymptoms.includes(s) ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
                >
                  {translateSymptom(s, lang)}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <textarea
              className="input min-h-[60px] resize-none"
              value={logNotes}
              onChange={(e) => setLogNotes(e.target.value)}
              placeholder="Any notes about your period..."
            />
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowAddModal(false)} className="btn-outline flex-1">Cancel</button>
            <button onClick={handleSavePeriod} className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}