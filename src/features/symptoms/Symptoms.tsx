import { translateSymptom, translateMood } from '@/lib/symptom-labels';
import { getLangCode } from '@/lib/lang-store';
import { useEffect, useState } from 'react';
import { HeartPulse, Trash2, Calendar as CalIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useCycleData } from '@/lib/use-cycle-data';
import { formatDate } from '@/lib/cycle';
import { PHYSICAL_SYMPTOMS, EMOTIONAL_SYMPTOMS, MOODS } from '@/lib/types';
import { Badge, EmptyState, LoadingState } from '@/components/ui';
import type { SymptomEntry } from '@/lib/types';

export default function Symptoms() {
  const { user } = useAuth();
  const { symptoms, loading, fetchData } = useCycleData(user?.id);
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState('');
  const [pain, setPain] = useState(0);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) fetchData(user.id);
  }, [user, fetchData]);

  useEffect(() => {
    const existing = symptoms.find((s) => s.entry_date === selectedDate);
    if (existing) {
      setSelectedSymptoms(existing.symptoms || []);
      setMood(existing.mood || '');
      setPain(existing.pain || 0);
      setNotes(existing.notes || '');
    } else {
      setSelectedSymptoms([]);
      setMood('');
      setPain(0);
      setNotes('');
    }
  }, [selectedDate, symptoms]);

  const toggleSymptom = (s: string) => {
    setSelectedSymptoms((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const existing = symptoms.find((s) => s.entry_date === selectedDate);
    try {
      if (existing) {
        await supabase.from('symptoms').update({
          symptoms: selectedSymptoms,
          mood: mood || null,
          pain,
          notes: notes || null,
        }).eq('id', existing.id);
      } else {
        await supabase.from('symptoms').insert({
          user_id: user.id,
          entry_date: selectedDate,
          symptoms: selectedSymptoms,
          mood: mood || null,
          pain,
          notes: notes || null,
        });
      }
      await fetchData(user.id);
    } catch (err) {
      console.error('Save symptoms error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await supabase.from('symptoms').delete().eq('id', id);
    await fetchData(user.id);
  };

  const recentEntries = [...symptoms].reverse().slice(0, 10);

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Symptom Tracking</h1>

      {/* Date selector */}
      <div className="card">
        <label className="label">Date</label>
        <input type="date" className="input" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} max={formatDate(new Date())} />
      </div>

      {/* Mood */}
      <div className="card">
        <h2 className="section-title mb-3">Mood</h2>
        <div className="flex gap-2 flex-wrap">
          {MOODS.map((m) => (
            <button
              key={m}
              onClick={() => setMood(mood === m ? '' : m)}
              className={`chip ${mood === m ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Physical Symptoms */}
      <div className="card">
        <h2 className="section-title mb-3">Physical Symptoms</h2>
        <div className="flex flex-wrap gap-2">
          {PHYSICAL_SYMPTOMS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              className={`chip ${selectedSymptoms.includes(s) ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
            >
              {translateSymptom(s, lang)}
            </button>
          ))}
        </div>
      </div>

      {/* Emotional Symptoms */}
      <div className="card">
        <h2 className="section-title mb-3">Emotional Symptoms</h2>
        <div className="flex flex-wrap gap-2">
          {EMOTIONAL_SYMPTOMS.map((s) => (
            <button
              key={s}
              onClick={() => toggleSymptom(s)}
              className={`chip ${selectedSymptoms.includes(s) ? 'bg-accent text-white' : 'bg-gray-100 dark:bg-gray-800 text-ink dark:text-gray-300'}`}
            >
              {translateSymptom(s, lang)}
            </button>
          ))}
        </div>
      </div>

      {/* Pain */}
      <div className="card">
        <div className="flex items-center justify-between mb-2">
          <h2 className="section-title">Pain Level</h2>
          <span className="text-lg font-bold text-primary">{pain}/10</span>
        </div>
        <input type="range" min={0} max={10} value={pain} onChange={(e) => setPain(Number(e.target.value))} className="w-full accent-primary" />
        <div className="flex justify-between text-xs text-ink-muted dark:text-ink-muted-dark mt-1">
          <span>No pain</span><span>Severe</span>
        </div>
      </div>

      {/* Notes */}
      <div className="card">
        <label className="label">Notes</label>
        <textarea className="input min-h-[80px] resize-none" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes..." />
      </div>

      <button onClick={handleSave} className="btn-primary w-full" disabled={saving}>
        {saving ? 'Saving...' : 'Save Entry'}
      </button>

      {/* Recent entries */}
      <div>
        <h2 className="section-title mb-3">Recent Entries</h2>
        {loading ? (
          <LoadingState />
        ) : recentEntries.length === 0 ? (
          <EmptyState icon={<HeartPulse size={40} />} title="No symptom entries yet" message="Start logging your symptoms to see them here." />
        ) : (
          <div className="space-y-2">
            {recentEntries.map((entry: SymptomEntry) => (
              <div key={entry.id} className="card flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary dark:bg-primary-800 flex items-center justify-center flex-shrink-0">
                  <CalIcon size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink dark:text-gray-100">
                    {new Date(entry.entry_date + 'T00:00:00').toLocaleDateString(getLangCode(), { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {entry.mood && <Badge color="accent">{entry.mood}</Badge>}
                  {entry.symptoms && entry.symptoms.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {entry.symptoms.slice(0, 4).map((s) => (
                        <span key={s} className="text-xs text-ink-muted dark:text-ink-muted-dark">{translateSymptom(s, lang)}</span>
                      )).reduce((acc: React.ReactNode[], el, i) => {
                        if (i > 0) acc.push(<span key={`sep${i}`} className="text-gray-300">·</span>);
                        acc.push(el);
                        return acc;
                      }, [])}
                      {entry.symptoms.length > 4 && <span className="text-xs text-ink-muted">+{entry.symptoms.length - 4}</span>}
                    </div>
                  )}
                  {entry.pain > 0 && <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1">Pain: {entry.pain}/10</p>}
                  {entry.notes && <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-1 italic">"{entry.notes}"</p>}
                </div>
                <button onClick={() => handleDelete(entry.id)} className="p-2 text-gray-400 hover:text-error flex-shrink-0">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}