import type { ReactNode } from 'react';

export type ArtName = 'sprig' | 'bloom' | 'leaves';

/** Small botanical illustrations that share the home hero's soft style. Theme-aware in light and dark. */
export function HeaderArt({ art, className = '' }: { art: ArtName; className?: string }) {
  if (art === 'bloom') {
    return (
      <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden="true" focusable="false">
        <circle cx="66" cy="54" r="46" className="fill-white/40 dark:fill-white/5" />
        <path d="M64 118 C 62 96, 68 80, 66 66" className="stroke-success-500 dark:stroke-success-400" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M65 100 C 50 98, 40 90, 38 80 C 52 80, 62 88, 65 100 Z" className="fill-success-300 dark:fill-success-600/60" />
        <g transform="translate(66 52)">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx="0"
              cy="-16"
              rx="9.5"
              ry="17"
              transform={`rotate(${a})`}
              className="fill-accent-300 stroke-accent-500/50 dark:fill-accent-500/50 dark:stroke-accent-300/40"
              strokeWidth="1"
            />
          ))}
          <circle r="5" className="fill-warning-300 dark:fill-warning-400" />
        </g>
      </svg>
    );
  }

  if (art === 'leaves') {
    return (
      <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden="true" focusable="false">
        <circle cx="62" cy="56" r="46" className="fill-white/40 dark:fill-white/5" />
        <g transform="translate(60 112)">
          <path d="M0 0 C -14 -22, -10 -50, 0 -72 C 10 -50, 14 -22, 0 0 Z" transform="rotate(-42) scale(0.85)" className="fill-primary-200 dark:fill-primary-400/40" />
          <path d="M0 0 C -14 -22, -10 -50, 0 -72 C 10 -50, 14 -22, 0 0 Z" transform="rotate(42) scale(0.85)" className="fill-accent-300 dark:fill-accent-500/50" />
          <path d="M0 0 C -14 -22, -10 -50, 0 -72 C 10 -50, 14 -22, 0 0 Z" className="fill-success-300 dark:fill-success-600/60" />
          <path d="M0 0 L 0 -58" className="stroke-success-500/60 dark:stroke-success-300/50" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  const leaves: [number, number, number][] = [
    [60, 96, -40],
    [62, 80, -140],
    [63, 62, -40],
    [63, 46, -140],
    [62, 30, -40],
  ];
  return (
    <svg viewBox="0 0 120 120" className={className} fill="none" aria-hidden="true" focusable="false">
      <circle cx="64" cy="58" r="46" className="fill-white/40 dark:fill-white/5" />
      <path d="M60 118 C 58 92, 66 62, 62 12" className="stroke-success-500 dark:stroke-success-400" strokeWidth="2.5" strokeLinecap="round" />
      {leaves.map(([x, y, r], i) => (
        <path
          key={i}
          transform={`translate(${x} ${y}) rotate(${r})`}
          d="M0 0 C 10 -8, 24 -8, 32 0 C 24 8, 10 8, 0 0 Z"
          className={i % 2 === 0 ? 'fill-success-300 dark:fill-success-600/60' : 'fill-primary-200 dark:fill-primary-400/40'}
        />
      ))}
      <circle cx="62" cy="12" r="3.5" className="fill-accent-400 dark:fill-accent-400/80" />
    </svg>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  art?: ArtName;
  children?: ReactNode;
}

/** Soft gradient header card used at the top of every secondary screen. */
export function PageHeader({ title, subtitle, art = 'sprig', children }: PageHeaderProps) {
  return (
    <section className="hero-surface relative overflow-hidden rounded-3xl border border-white/60 px-5 py-5 shadow-soft dark:border-white/10">
      <HeaderArt art={art} className="pointer-events-none absolute -right-3 -top-2 h-24 w-24 opacity-90" />
      <div className="relative pr-20">
        <h1 className="break-words font-serif text-2xl text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-sm leading-relaxed text-ink-muted">{subtitle}</p>}
      </div>
      {children && <div className="relative mt-4">{children}</div>}
    </section>
  );
}