import { ChevronRight } from 'lucide-react';
import { articleContent } from './Education';
import { useState } from 'react';

const topics = [
  { id: 'fertility', title: 'Understanding Fertility', summary: 'The basics of fertility and the menstrual cycle.' },
  { id: 'ovulation', title: 'Ovulation', summary: 'What happens during ovulation and why it matters.' },
  { id: 'contraception', title: 'Contraception Basics', summary: 'Understanding birth control options.' },
];

export default function ReproductiveHealth() {
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
            This information is general health education and is not a substitute for professional medical advice. Cycle and fertility window predictions should not be treated as guaranteed contraception.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-ink dark:text-gray-100">Reproductive Health</h1>
      <p className="text-sm text-ink-muted dark:text-ink-muted-dark">Educational content about reproductive health, fertility, and contraception.</p>
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
