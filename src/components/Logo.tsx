import { Droplet } from 'lucide-react';

export function Logo({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = {
    sm: { icon: 20, text: 'text-lg' },
    md: { icon: 28, text: 'text-xl' },
    lg: { icon: 40, text: 'text-3xl' },
  };
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative">
        <div className="flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-accent-500 text-white shadow-md" style={{ width: s.icon + 12, height: s.icon + 12 }}>
          <Droplet size={s.icon} fill="currentColor" />
        </div>
      </div>
      <span className={`font-serif font-bold tracking-tight ${s.text} text-neutral-900 dark:text-neutral-100`}>
        FemCare<span className="text-accent-500">+</span>
      </span>
    </div>
  );
}
