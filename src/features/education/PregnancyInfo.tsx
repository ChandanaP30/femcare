import { useState } from 'react';
import { ChevronRight, Baby } from 'lucide-react';
import { articleContent } from './Education';

const topics = [
  { id: 'pregnancy-basics', title: 'Early Pregnancy Basics', summary: 'Signs of early pregnancy and what to expect.' },
  { id: 'prenatal', title: 'Prenatal Care', summary: 'Basics of prenatal care and nutrition.' },
  { id: 'warning-signs', title: 'Warning Signs', summary: 'When to contact a healthcare professional during pregnancy.' },
];

export default function PregnancyInfo() {
  const [selected, setSelected] = useState<string | null>(null);

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
            This information is general health education and is not a substitute for professional medical advice. This section does not assume you are pregnant.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2">
        <Baby size={24} className="text-primary" />
        <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Pregnancy Information</h1>
      </div>
      <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Educational content about pregnancy. This section does not assume you are pregnant. Pregnancy tracking, if available, would be an optional mode you explicitly activate.</p>
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
