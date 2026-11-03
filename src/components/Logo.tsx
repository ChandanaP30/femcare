export function Logo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = {
    sm: { icon: 32, text: 'text-lg' },
    md: { icon: 40, text: 'text-xl' },
    lg: { icon: 56, text: 'text-3xl' },
  };
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src={`${import.meta.env.BASE_URL}app-icon.png`}
        alt="FemCare+"
        width={s.icon}
        height={s.icon}
        className="shrink-0 rounded-2xl shadow-soft"
        style={{ width: s.icon, height: s.icon }}
      />
      <span className={`font-serif font-semibold tracking-tight ${s.text} text-ink`}>
        FemCare<span className="text-accent-500 dark:text-accent-400">+</span>
      </span>
    </div>
  );
}