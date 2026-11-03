import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} size={20} />;
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Spinner className="text-primary-500" />
      <p className="text-sm text-ink-muted">{message}</p>
    </div>
  );
}

export function EmptyState({ icon, title, message }: { icon?: ReactNode; title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-2">
      {icon && <div className="text-ink-muted/60 mb-2">{icon}</div>}
      <p className="text-sm font-medium text-ink">{title}</p>
      {message && <p className="text-sm text-ink-muted max-w-sm">{message}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
      <p className="text-sm text-error-600 dark:text-error-300">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-outline text-sm">Retry</button>}
    </div>
  );
}

export function Badge({ children, color = 'primary' }: { children: ReactNode; color?: 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'gray' }) {
  const colors: Record<string, string> = {
    primary: 'bg-primary-100 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200',
    accent: 'bg-accent-200 text-ink-onlight dark:bg-accent-600/25 dark:text-accent-300',
    success: 'bg-success-200 text-success-700 dark:bg-success-700/30 dark:text-success-300',
    warning: 'bg-warning-100 text-warning-600 dark:bg-warning-600/30 dark:text-warning-200',
    error: 'bg-error-100 text-error-600 dark:bg-error-600/30 dark:text-error-200',
    gray: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-card border border-primary-100/70 dark:border-white/10 rounded-2xl shadow-soft-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-primary-100/70 dark:border-white/10">
            <h3 className="font-semibold text-ink">{title}</h3>
            <button onClick={onClose} className="text-ink-muted hover:text-ink text-xl leading-none" aria-label="Close">&times;</button>
          </div>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-soft transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      {label && <span className="text-sm text-ink">{label}</span>}
    </label>
  );
}