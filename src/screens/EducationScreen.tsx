import { useState } from 'react';
import { EDUCATION_ARTICLES, EDUCATION_CATEGORIES, type EducationArticle } from '@/lib/education';
import { ChevronRight, ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

export function EducationScreen() {
  const { t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<EducationArticle | null>(null);

  if (selectedArticle) {
    return (
      <div className="space-y-5 animate-fade-in">
        <button
          onClick={() => setSelectedArticle(null)}
          className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
        >
          <ArrowLeft size={16} /> {t('backToArticles')}
        </button>

        <div>
          <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">{selectedArticle.category}</span>
          <h1 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">{selectedArticle.title}</h1>
          <p className="text-neutral-600 dark:text-neutral-400 text-sm mt-2 leading-relaxed">{selectedArticle.summary}</p>
        </div>

        <div className="card p-5 space-y-4">
          {selectedArticle.content.map((para, i) => (
            <p key={i} className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed">{para}</p>
          ))}
        </div>

        {selectedArticle.references.length > 0 && (
          <div>
            <h3 className="section-title mb-2">{t('references')}</h3>
            <div className="space-y-2">
              {selectedArticle.references.map((ref, i) => (
                <a
                  key={i}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card p-3 flex items-center justify-between hover:shadow-md transition-all"
                >
                  <span className="text-sm text-primary-600 dark:text-primary-400 font-medium truncate">{ref.label}</span>
                  <ExternalLink size={16} className="text-neutral-400 shrink-0 ml-2" />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="card-soft p-4">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('educationDisclaimer')}
          </p>
        </div>
      </div>
    );
  }

  const filteredArticles = selectedCategory
    ? EDUCATION_ARTICLES.filter((a) => a.category === selectedCategory)
    : EDUCATION_ARTICLES;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-serif text-2xl font-bold text-neutral-900 dark:text-neutral-100">{t('healthEducation')}</h1>
        <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-1">{t('healthEducationSubtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`chip text-xs ${!selectedCategory ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
        >
          {t('all')}
        </button>
        {EDUCATION_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`chip text-xs ${selectedCategory === cat ? 'bg-primary-500 text-white' : 'bg-neutral-100 dark:bg-neutral-700/50 text-neutral-600 dark:text-neutral-300'}`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredArticles.map((article) => (
          <button
            key={article.id}
            onClick={() => setSelectedArticle(article)}
            className="card p-4 flex items-start gap-4 text-left hover:shadow-md transition-all w-full"
          >
            <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
              <BookOpen size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">{article.category}</span>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm mt-0.5">{article.title}</h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">{article.summary}</p>
            </div>
            <ChevronRight size={18} className="text-neutral-400 shrink-0 mt-1" />
          </button>
        ))}
      </div>
    </div>
  );
}
