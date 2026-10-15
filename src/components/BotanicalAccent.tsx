interface BotanicalAccentProps {
  className?: string;
  size?: number;
}

/** Delicate line-drawn flower. Decorative only: place it beside content, never behind text. */
export default function BotanicalAccent({ className = '', size = 48 }: BotanicalAccentProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <g opacity="0.9">
        <path d="M32 30 C 24 24, 24 14, 32 10 C 40 14, 40 24, 32 30 Z" />
        <path d="M32 30 C 38 24, 48 24, 52 32 C 48 40, 38 40, 32 30 Z" />
        <path d="M32 30 C 40 36, 40 46, 32 50 C 24 46, 24 36, 32 30 Z" />
        <path d="M32 30 C 26 36, 16 36, 12 32 C 16 24, 26 24, 32 30 Z" />
        <path d="M32 30 C 26 24, 18 20, 16 14 C 24 12, 30 20, 32 30 Z" opacity="0.6" />
        <path d="M32 30 C 38 24, 46 20, 48 14 C 40 12, 34 20, 32 30 Z" opacity="0.6" />
      </g>
      <circle cx="32" cy="30" r="2.6" />
      <path d="M32 40 L 32 60" />
      <path d="M32 52 C 26 50, 22 46, 21 42 C 27 43, 31 46, 32 52 Z" opacity="0.7" />
    </svg>
  );
}