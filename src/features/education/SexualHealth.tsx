import { useState } from 'react';
import { ChevronRight, Shield, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { articleContent } from './Education';

const topics = [
  { id: 'consent', title: 'Consent & Relationships', summary: 'Understanding consent and healthy relationships.' },
  { id: 'safe-sex', title: 'Safe Sex', summary: 'Practising safe sex and preventing STIs.' },
  { id: 'stis', title: 'STIs', summary: 'Common STIs, symptoms, and testing.' },
];

export default function SexualHealth() {
  const { user, settings, refreshProfile } = useAuth();
  const [selected, setSelected] = useState<string | null>(null);
  const [visible, setVisible] = useState(settings?.sexual_health_visible ?? true);

  const toggleVisibility = async () => {
    const newVal = !visible;
    setVisible(newVal);
    if (user) {
      if (settings) {
        await supabase.from('user_settings').update({ sexual_health_visible: newVal }).eq('user_id', user.id);
      } else {
        await supabase.from('user_settings').insert({ user_id: user.id, sexual_health_visible: newVal });
      }
      await refreshProfile();
    }
  };

  if (!visible) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Sexual Health</h1>
        <div className="card flex flex-col items-center py-12 text-center">
          <Shield size={40} className="text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-ink dark:text-gray-100 font-medium">This section is hidden</p>
          <p className="text-sm text-ink-muted dark:text-ink-muted-dark mt-1 mb-4">You've chosen to hide sexual health content. You can enable it anytime.</p>
          <button onClick={toggleVisibility} className="btn-primary">Show Section</button>
        </div>
      </div>
    );
  }

  if (selected) {
    const content = articleContent[selected];
    return (
      <div className="space-y-6 animate-fade-in">
        <button onClick={() => setSelected(null)} className="btn-ghost text-sm">
          <ChevronRight className="rotate-180" size={16} /> Back
        </button>
        <div className="card">
          <h1 className="text-xl font-bold text-ink dark:text-gray-100 mb-2">{topics.find(t => t.id === selected)?.title}</h1>
          {content ? (
            <>
              {content.content.split('\n\n').map((para, i) => (
                <p key={i} className="text-sm text-ink dark:text-gray-200 mb-3 leading-relaxed">{para}</p>
              ))}
              <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                <p className="text-xs font-semibold text-ink-muted dark:text-ink-muted-dark mb-2">References:</p>
                <ul className="space-y-1">
                  {content.references.map((ref, i) => (
                    <li key={i} className="text-xs text-ink-muted dark:text-ink-muted-dark">• {ref}</li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-sm text-ink-muted">Content coming soon.</p>
          )}
        </div>
        <div className="card bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-900">
          <p className="text-sm text-ink dark:text-gray-200">
            This information is general health education and is not a substitute for professional medical advice. The AI assistant never makes assumptions about your sexual activity.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Sexual Health</h1>
        <button onClick={toggleVisibility} className="btn-outline text-sm">
          <EyeOff size={16} /> Hide Section
        </button>
      </div>
      <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Respectful, medically appropriate education about sexual health. This section is private and can be hidden.</p>
      <div className="space-y-2">
        {topics.map(topic => (
          <button key={topic.id} onClick={() => setSelected(topic.id)} className="card w-full text-left flex items-center gap-3 hover:shadow-md transition-all">
            <div className="flex-1">
              <p className="text-sm font-medium text-ink dark:text-gray-100">{topic.title}</p>
              <p className="text-xs text-ink-muted dark:text-ink-muted-dark mt-0.5">{topic.summary}</p>
            </div>
            <ChevronRight size={18} className="text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
