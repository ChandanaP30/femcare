import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { EmergencyContact } from '@/lib/types';
import { MapPin, Pill, Phone, Plus, Trash2, X, MessageSquare, ShieldCheck, ChevronRight, Siren } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import BotanicalAccent from '@/components/BotanicalAccent';

export function SosScreen({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRelationship, setNewRelationship] = useState('');
  const [saving, setSaving] = useState(false);

  const loadContacts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setContacts((data as EmergencyContact[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  async function addContact() {
    if (!user || !newName.trim() || !newPhone.trim()) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('emergency_contacts')
      .insert({ user_id: user.id, name: newName, phone: newPhone, relationship: newRelationship })
      .select()
      .single();
    if (!error && data) {
      setContacts((prev) => [...prev, data as EmergencyContact]);
      setNewName('');
      setNewPhone('');
      setNewRelationship('');
      setShowAdd(false);
    }
    setSaving(false);
  }

  async function deleteContact(id: string) {
    if (!confirm(t('removeContactConfirm'))) return;
    const { error } = await supabase.from('emergency_contacts').delete().eq('id', id);
    if (!error) setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* Header */}
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink-muted">FemCare+</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink mt-1.5 break-words">{t('sosTitle')}</h1>
        </div>
        <BotanicalAccent size={44} className="hidden sm:block shrink-0 text-primary-400" />
      </header>

      {/* Emergency banner */}
      <section className="card p-6">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-error-100 text-error-600">
            <Siren size={22} strokeWidth={1.75} />
          </span>
          <div className="min-w-0">
            <h2 className="font-serif text-lg text-ink">{t('needHelpQuickly')}</h2>
            <p className="mt-1 text-sm leading-relaxed text-ink-muted">{t('emergencyAdvice')}</p>
          </div>
        </div>
        <a
          href="tel:112"
          aria-label="Call emergency number 112"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-error-300 px-5 py-3.5 text-base font-semibold text-ink shadow-soft transition-all hover:bg-error-400 active:scale-[0.98]"
        >
          <Phone size={18} strokeWidth={2} />
          112
        </a>
      </section>

      {/* Nearby services */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={() => onNavigate('locator')}
          className="card flex items-center gap-4 p-4 text-left transition-all hover:shadow-lift focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
            <MapPin size={20} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">{t('findNearbyMedicalStores')}</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{t('findNearbyMedicalStoresDesc')}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-ink-muted" />
        </button>

        <button
          onClick={() => onNavigate('locator')}
          className="card flex items-center gap-4 p-4 text-left transition-all hover:shadow-lift focus:outline-none focus:ring-2 focus:ring-primary-300"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent-300 text-ink">
            <Pill size={20} strokeWidth={1.75} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">{t('findSanitaryProducts')}</span>
            <span className="mt-0.5 block text-xs leading-snug text-ink-muted">{t('findSanitaryProductsDesc')}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-ink-muted" />
        </button>
      </section>

      {/* Emergency contacts */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="section-title">{t('emergencyContacts')}</h3>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-primary-200"
          >
            <Plus size={16} strokeWidth={2} />
            {t('addContact')}
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : contacts.length === 0 ? (
          <div className="card flex flex-col items-center p-6 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-200 text-ink-muted">
              <Phone size={20} strokeWidth={1.75} />
            </span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-muted">{t('noContactsAdded')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {contacts.map((c) => (
              <div key={c.id} className="card flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 font-serif text-base text-ink">
                  {c.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{c.name}</p>
                  <p className="truncate text-xs text-ink-muted">
                    {c.phone}{c.relationship ? ` · ${c.relationship}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={`tel:${c.phone}`}
                    aria-label={`Call ${c.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-success-200 text-success-700 transition-colors hover:bg-success-300"
                  >
                    <Phone size={16} strokeWidth={1.75} />
                  </a>
                  <a
                    href={`sms:${c.phone}`}
                    aria-label={`Message ${c.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-primary-700 transition-colors hover:bg-primary-200"
                  >
                    <MessageSquare size={16} strokeWidth={1.75} />
                  </a>
                  <button
                    onClick={() => deleteContact(c.id)}
                    aria-label={`Delete ${c.name}`}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-error-50 text-error-600 transition-colors hover:bg-error-100"
                  >
                    <Trash2 size={16} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Safety notice */}
      <section className="flex items-start gap-3 rounded-2xl border border-success-200 bg-success-50 p-4">
        <ShieldCheck size={20} strokeWidth={1.75} className="mt-0.5 shrink-0 text-success-700" />
        <p className="text-sm leading-relaxed text-ink">{t('femcareNoAutoSend')}</p>
      </section>

      {/* Add contact dialog */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowAdd(false)}>
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-sm" />
          <div className="relative card w-full max-w-sm p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-serif text-lg text-ink">{t('addContact')}</h3>
              <button
                onClick={() => setShowAdd(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-primary-50 hover:text-ink"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label-text">{t('name')}</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={t('name')} className="input-field" />
              </div>
              <div>
                <label className="label-text">{t('phone')}</label>
                <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="+1 234 567 8900" className="input-field" />
              </div>
              <div>
                <label className="label-text">
                  {t('relationship')} <span className="font-normal text-ink-muted">({t('optional')})</span>
                </label>
                <input type="text" value={newRelationship} onChange={(e) => setNewRelationship(e.target.value)} placeholder={t('relationship')} className="input-field" />
              </div>
            </div>
            <button
              onClick={addContact}
              disabled={saving || !newName.trim() || !newPhone.trim()}
              className="btn-primary mt-6 w-full"
            >
              {saving ? t('saving') : t('addContact')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}