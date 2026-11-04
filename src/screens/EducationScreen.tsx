import { useState } from 'react';
import { EDUCATION_ARTICLES, EDUCATION_CATEGORIES, type EducationArticle } from '@/lib/education';
import { localizeArticle } from '@/lib/education-i18n';
import { ChevronRight, ArrowLeft, BookOpen, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { PageHeader, HeaderArt } from '@/components/PageHeader';

const CATEGORY_KEY: Record<string, string> = {
  'Menstrual cycle basics': 'catCycleBasics',
  'Period cramps': 'catPeriodCramps',
  'PMS': 'catPms',
  'Hygiene': 'catHygiene',
  'Nutrition': 'catNutrition',
  'Exercise': 'catExercise',
  'Mental wellbeing': 'catMentalWellbeing',
  'When to seek medical help': 'catWhenToSeekHelp',
};

export function EducationScreen() {
  const { t, lang } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<EducationArticle | null>(null);

  type Key = Parameters<typeof t>[0];
  const catLabel = (cat: string) => (CATEGORY_KEY[cat] ? t(CATEGORY_KEY[cat] as Key) : cat);

  if (selectedArticle) {
    const shown = localizeArticle(selectedArticle, lang);
    return (
      <div className="space-y-5 pb-8">
        <button
          onClick={() => setSelectedArticle(null)}
          className="inline-flex items-center gap-2 rounded-full bg-primary-100 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-primary-200 dark:bg-primary-900/50 dark:hover:bg-primary-900/70"
        >
          <ArrowLeft size={16} /> {t('backToArticles')}
        </button>

        <section className="hero-surface relative overflow-hidden rounded-3xl border border-white/60 p-5 shadow-soft dark:border-white/10">
          <HeaderArt art="leaves" className="pointer-events-none absolute -right-3 -top-2 h-24 w-24 opacity-90" />
          <div className="relative pr-16">
            <span className="inline-flex rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-medium text-primary-800 dark:bg-white/10 dark:text-primary-200">
              {catLabel(selectedArticle.category)}
            </span>
            <h1 className="mt-2 break-words font-serif text-2xl text-ink">{shown.title}</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-muted">{shown.summary}</p>
          </div>
        </section>

        <section className="card space-y-4 p-5">
          {shown.content.map((para, i) => (
            <p key={i} className="text-sm leading-7 text-ink">{para}</p>
          ))}
        </section>

        {shown.references.length > 0 && (
          <section>
            <h3 className="section-title mb-2">{t('references')}</h3>
            <div className="space-y-2">
              {shown.references.map((ref, i) => (
                <a
                  key={i}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card flex items-center justify-between p-3 transition-shadow hover:shadow-lift"
                >
                  <span className="truncate text-sm font-medium text-primary-700 dark:text-primary-300">{ref.label}</span>
                  <ExternalLink size={16} className="ml-2 shrink-0 text-ink-muted" />
                </a>
              ))}
            </div>
          </section>
        )}

        <div className="card-soft p-4">
          <p className="text-xs leading-relaxed text-ink-muted">{t('educationDisclaimer')}</p>
        </div>
      </div>
    );
  }

  const filteredArticles = (selectedCategory
    ? EDUCATION_ARTICLES.filter((a) => a.category === selectedCategory)
    : EDUCATION_ARTICLES
  ).map((a) => localizeArticle(a, lang));

  const chipOff = 'bg-bg-card text-ink-muted ring-1 ring-primary-100 dark:ring-white/15';

  return (
    <div className="space-y-5 pb-8">
      <PageHeader title={t('healthEducation')} subtitle={t('healthEducationSubtitle')} art="leaves" />

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`chip shrink-0 whitespace-nowrap text-xs ${!selectedCategory ? 'bg-primary-500 text-ink-onlight' : chipOff}`}
        >
          {t('all')}
        </button>
        {EDUCATION_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`chip shrink-0 whitespace-nowrap text-xs ${selectedCategory === cat ? 'bg-primary-500 text-ink-onlight' : chipOff}`}
          >
            {catLabel(cat)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredArticles.map((article) => (
          <button
            key={article.id}
            onClick={() => setSelectedArticle(EDUCATION_ARTICLES.find((a) => a.id === article.id) ?? null)}
            className="card flex w-full items-start gap-4 p-4 text-left transition-shadow hover:shadow-lift focus:outline-none focus:ring-2 focus:ring-primary-300"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/50 dark:text-primary-300">
              <BookOpen size={20} strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-primary-700 dark:text-primary-300">{catLabel(article.category)}</span>
              <h3 className="mt-0.5 text-sm font-semibold text-ink">{article.title}</h3>
              <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">{article.summary}</p>
            </div>
            <ChevronRight size={18} className="mt-1 shrink-0 text-ink-muted" />
          </button>
        ))}
      </div>
    </div>
  );
}