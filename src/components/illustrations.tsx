import type { CyclePhase } from '@/lib/types';

const PETAL_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Original botanical bloom for the home hero. Colours come from theme tokens, so it works in light and dark. */
export function HeroBloom({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 160" className={className} fill="none" aria-hidden="true" focusable="false">
      <circle cx="88" cy="66" r="58" className="fill-white/40 dark:fill-white/5" />
      <path
        d="M84 88 C 82 114, 90 138, 86 158"
        className="stroke-success-500 dark:stroke-success-400"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M85 130 C 66 128, 52 116, 50 102 C 68 102, 82 112, 85 130 Z"
        className="fill-success-300 stroke-success-500/50 dark:fill-success-600/60 dark:stroke-success-400/50"
        strokeWidth="1"
      />
      <path
        d="M86 114 C 104 112, 118 100, 120 86 C 102 86, 88 98, 86 114 Z"
        className="fill-success-200 stroke-success-500/50 dark:fill-success-700/60 dark:stroke-success-400/50"
        strokeWidth="1"
      />
      <g transform="translate(84 62)">
        {PETAL_ANGLES.map((a) => (
          <ellipse
            key={a}
            cx="0"
            cy="-21"
            rx="10"
            ry="20"
            transform={`rotate(${a})`}
            className="fill-accent-300 stroke-accent-500/50 dark:fill-accent-500/50 dark:stroke-accent-300/40"
            strokeWidth="1"
          />
        ))}
        {PETAL_ANGLES.map((a) => (
          <ellipse
            key={`inner-${a}`}
            cx="0"
            cy="-12"
            rx="6"
            ry="12"
            transform={`rotate(${a + 22.5})`}
            className="fill-white/70 dark:fill-accent-300/25"
          />
        ))}
        <circle r="6" className="fill-warning-300 dark:fill-warning-400" />
      </g>
      <circle cx="132" cy="112" r="3.5" className="fill-primary-300 dark:fill-primary-400/70" />
      <circle cx="140" cy="100" r="2" className="fill-primary-200 dark:fill-primary-400/50" />
    </svg>
  );
}

/** Small line illustration for each cycle phase. Uses currentColor. */
export function PhaseIllustration({ phase, className = '' }: { phase: CyclePhase; className?: string }) {
  const common = {
    viewBox: '0 0 24 24',
    className,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };

  if (phase === 'menstrual') {
    return (
      <svg {...common}>
        <path d="M12 3 C 12 3, 5.5 10.2, 5.5 14.5 a6.5 6.5 0 0 0 13 0 C 18.5 10.2, 12 3, 12 3 Z" />
        <path d="M9 15 a3 3 0 0 0 2.5 2.5" />
      </svg>
    );
  }
  if (phase === 'follicular') {
    return (
      <svg {...common}>
        <path d="M12 21 V 11" />
        <path d="M12 13 C 12 9, 8.5 7, 5 7.5 C 5 11, 8 13, 12 13 Z" />
        <path d="M12 11 C 12 7.5, 15 5, 19 5.2 C 19 9, 16 11, 12 11 Z" />
      </svg>
    );
  }
  if (phase === 'ovulation') {
    return (
      <svg {...common}>
        <g transform="translate(12 12)">
          {[0, 60, 120, 180, 240, 300].map((a) => (
            <ellipse key={a} cx="0" cy="-5.2" rx="2.6" ry="4.2" transform={`rotate(${a})`} />
          ))}
          <circle r="1.6" />
        </g>
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}