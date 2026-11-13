import { Loader2, Pill, Stethoscope, RefreshCw } from 'lucide-react';
import { googleMapsSearchUrl } from '@/lib/slow-search';

/** Original kawaii map-pin mascot. Uses theme colours, so it works in light and dark. */
function ApologyMascot({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 170" className={className} fill="none" role="img" aria-label="A sorry little map pin character">
      <ellipse cx="80" cy="158" rx="30" ry="6" className="fill-primary-900/10 dark:fill-black/30" />
      {/* sparkles */}
      <circle cx="24" cy="46" r="3" className="fill-accent-400" />
      <circle cx="142" cy="78" r="2.5" className="fill-primary-300 dark:fill-primary-400" />
      <path d="M134 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z" className="fill-warning-300" />
      {/* pin body */}
      <path
        d="M80 152 C 80 152, 30 104, 30 70 a50 50 0 1 1 100 0 C130 104, 80 152, 80 152 Z"
        className="fill-primary-300 stroke-primary-500/60 dark:fill-primary-400/80 dark:stroke-primary-300/50"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M46 54 a36 36 0 0 1 26 -24" stroke="white" strokeOpacity="0.65" strokeWidth="5" strokeLinecap="round" />
      {/* worried brows */}
      <path d="M52 54 L68 47" className="stroke-primary-900" strokeWidth="3" strokeLinecap="round" />
      <path d="M108 54 L92 47" className="stroke-primary-900" strokeWidth="3" strokeLinecap="round" />
      {/* big watery eyes */}
      <ellipse cx="62" cy="70" rx="9" ry="11" className="fill-primary-900" />
      <ellipse cx="98" cy="70" rx="9" ry="11" className="fill-primary-900" />
      <circle cx="59" cy="65" r="4" fill="white" />
      <circle cx="95" cy="65" r="4" fill="white" />
      <circle cx="66" cy="75" r="2" fill="white" />
      <circle cx="102" cy="75" r="2" fill="white" />
      {/* blush, tear, wobbly mouth */}
      <ellipse cx="45" cy="86" rx="8" ry="5" className="fill-accent-400" opacity="0.85" />
      <ellipse cx="115" cy="86" rx="8" ry="5" className="fill-accent-400" opacity="0.85" />
      <path d="M52 84 q4 6 0 10 q-4 -4 0 -10 z" fill="white" opacity="0.9" />
      <path d="M73 96 Q80 90 87 96" className="stroke-primary-900" strokeWidth="2.5" strokeLinecap="round" />
      {/* hands */}
      <circle cx="68" cy="116" r="7" className="fill-primary-200 stroke-primary-500/40 dark:fill-primary-300" strokeWidth="1" />
      <circle cx="92" cy="116" r="7" className="fill-primary-200 stroke-primary-500/40 dark:fill-primary-300" strokeWidth="1" />
      {/* sweat drop */}
      <path d="M124 30 q7 10 0 15 q-7 -5 0 -15 z" className="fill-primary-200 stroke-primary-400" strokeWidth="1" />
    </svg>
  );
}

interface LocationApologyProps {
  seconds: number;
  failed?: boolean;
  onRetry: () => void;
}

/**
 * Shown when a live search has taken a long time. It does not cancel anything: the search keeps
 * running, and the parent replaces this screen with the results (or the error) when they arrive.
 */
export function LocationApology({ seconds, failed = false, onRetry }: LocationApologyProps) {
  return (
    <section
      role="status"
      aria-live="polite"
      className="hero-surface relative overflow-hidden rounded-3xl border border-white/60 p-6 text-center shadow-soft dark:border-white/10"
    >
      <ApologyMascot className="mx-auto h-36 w-36" />
      <h2 className="mt-2 font-serif text-xl text-ink">{'Oopsie! Our little map is taking a break \u{1F97A}'}</h2>
      <p className="mt-1 text-sm text-ink-muted">Sorry for keeping you waiting!</p>

      {!failed && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs text-ink-muted dark:bg-white/10">
          <Loader2 size={12} className="animate-spin" />
          Still searching in the background {seconds}s
        </p>
      )}

      <div className="mt-5 space-y-2.5">
        <a
          href={googleMapsSearchUrl('pharmacy')}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex w-full items-center justify-center gap-2 text-sm"
        >
          <Pill size={16} /> Find Nearby Pharmacies
        </a>
        <a
          href={googleMapsSearchUrl('hospital')}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary flex w-full items-center justify-center gap-2 text-sm"
        >
          <Stethoscope size={16} /> Find Nearby Hospitals
        </a>
        <button type="button" onClick={onRetry} className="btn-secondary flex w-full items-center justify-center gap-2 text-sm">
          <RefreshCw size={15} /> Retry
        </button>
      </div>
    </section>
  );
}