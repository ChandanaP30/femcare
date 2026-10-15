import { useEffect, useState } from 'react';
import { Phone, MapPin, UserPlus, Trash2, Edit2, Phone as PhoneIcon } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Modal, Badge, EmptyState } from '@/components/ui';
import type { EmergencyContact } from '@/lib/types';
import type { PageId } from '@/components/AppShell';

export default function SOS({ onNavigate }: { onNavigate: (p: PageId) => void }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<EmergencyContact | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) loadContacts();
  }, [user]);

  const loadContacts = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('emergency_contacts').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    setContacts((data as unknown as EmergencyContact[]) || []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user || !name.trim() || !phone.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await supabase.from('emergency_contacts').update({ name, phone, relationship }).eq('id', editing.id);
      } else {
        await supabase.from('emergency_contacts').insert({ user_id: user.id, name, phone, relationship });
      }
      await loadContacts();
      setShowAdd(false);
      setEditing(null);
      setName(''); setPhone(''); setRelationship('');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await supabase.from('emergency_contacts').delete().eq('id', id);
    await loadContacts();
  };

  const startEdit = (c: EmergencyContact) => {
    setEditing(c);
    setName(c.name); setPhone(c.phone); setRelationship(c.relationship || '');
    setShowAdd(true);
  };

  const emergencyNumber = '112';

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">SOS</h1>

      <div className="card bg-error-50 dark:bg-error-900/20 border-error-200 dark:border-error-900">
        <h2 className="text-lg font-semibold text-ink dark:text-gray-100 mb-4">Need help quickly?</h2>
        <div className="space-y-3">
          <a href={`tel:${emergencyNumber}`} className="flex items-center gap-3 p-4 rounded-lg bg-error text-white hover:bg-error-500 transition-all active:scale-[0.98]">
            <Phone size={24} />
            <div>
              <p className="font-semibold">Call Emergency Service</p>
              <p className="text-sm text-white/80">Emergency number: {emergencyNumber}</p>
            </div>
          </a>
          <button onClick={() => onNavigate('nearby')} className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-bg-card-dark border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all w-full text-left">
            <MapPin size={24} className="text-primary" />
            <div>
              <p className="font-semibold text-ink dark:text-gray-100">Find Nearby Medical Help</p>
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Hospitals, clinics, pharmacies</p>
            </div>
          </button>
          <button onClick={() => onNavigate('nearby')} className="flex items-center gap-3 p-4 rounded-lg bg-white dark:bg-bg-card-dark border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all w-full text-left">
            <MapPin size={24} className="text-accent" />
            <div>
              <p className="font-semibold text-ink dark:text-gray-100">Find Nearby Sanitary Products</p>
              <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Pharmacies and stores near you</p>
            </div>
          </button>
        </div>
      </div>

      {/* Emergency Contacts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Emergency Contacts</h2>
          <button onClick={() => { setEditing(null); setName(''); setPhone(''); setRelationship(''); setShowAdd(true); }} className="btn-primary text-sm">
            <UserPlus size={16} /> Add
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-ink-muted">Loading...</div>
        ) : contacts.length === 0 ? (
          <EmptyState icon={<PhoneIcon size={40} />} title="No emergency contacts" message="Add trusted contacts you can reach quickly in an emergency." />
        ) : (
          <div className="space-y-2">
            {contacts.map(c => (
              <div key={c.id} className="card flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary dark:bg-primary-800 flex items-center justify-center text-primary font-semibold flex-shrink-0">
                  {c.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink dark:text-gray-100">{c.name}</p>
                  <p className="text-xs text-ink-muted dark:text-ink-muted-dark">{c.phone}{c.relationship ? ` · ${c.relationship}` : ''}</p>
                </div>
                <a href={`tel:${c.phone}`} className="p-2 rounded-lg bg-success-50 dark:bg-success-900/30 text-success-600 hover:bg-success-100">
                  <Phone size={16} />
                </a>
                <button onClick={() => startEdit(c)} className="p-2 text-gray-400 hover:text-primary">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => handleDelete(c.id)} className="p-2 text-gray-400 hover:text-error">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-900">
        <p className="text-sm text-ink dark:text-gray-200">
          FemCare+ never automatically sends messages or shares your location. All actions require your explicit confirmation.
        </p>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title={editing ? 'Edit Contact' : 'Add Emergency Contact'}>
        <div className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Contact name" />
          </div>
          <div>
            <label className="label">Phone number</label>
            <input className="input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 890" />
          </div>
          <div>
            <label className="label">Relationship (optional)</label>
            <input className="input" value={relationship} onChange={e => setRelationship(e.target.value)} placeholder="Family, friend, doctor..." />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="btn-outline flex-1">Cancel</button>
            <button onClick={handleSave} className="btn-primary flex-1" disabled={saving || !name.trim() || !phone.trim()}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
