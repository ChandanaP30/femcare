import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Spinner({ className = '' }: { className?: string }) {
  return <Loader2 className={`animate-spin ${className}`} size={20} />;
}

export function LoadingState({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Spinner className="text-primary" />
      <p className="text-sm text-ink-muted dark:text-ink-muted-dark">{message}</p>
    </div>
  );
}

export function EmptyState({ icon, title, message }: { icon?: ReactNode; title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-2">
      {icon && <div className="text-gray-300 dark:text-gray-600 mb-2">{icon}</div>}
      <p className="text-sm font-medium text-ink dark:text-gray-200">{title}</p>
      {message && <p className="text-sm text-ink-muted dark:text-ink-muted-dark max-w-sm">{message}</p>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center gap-3">
      <p className="text-sm text-error">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-outline text-sm">Retry</button>}
    </div>
  );
}

export function Badge({ children, color = 'primary' }: { children: ReactNode; color?: 'primary' | 'accent' | 'success' | 'warning' | 'error' | 'gray' }) {
  const colors: Record<string, string> = {
    primary: 'bg-primary-50 text-primary-700 dark:bg-primary-800 dark:text-primary-200',
    accent: 'bg-accent-50 text-accent-500 dark:bg-accent-900 dark:text-accent-200',
    success: 'bg-success-50 text-success-600 dark:bg-success-900 dark:text-success-200',
    warning: 'bg-warning-50 text-warning-500 dark:bg-warning-900 dark:text-warning-200',
    error: 'bg-error-50 text-error-500 dark:bg-error-900 dark:text-error-200',
    gray: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[color]}`}>{children}</span>;
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-bg-card dark:bg-bg-card-dark rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-slide-up">
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-semibold text-ink dark:text-gray-100">{title}</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl leading-none">&times;</button>
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
        className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      {label && <span className="text-sm text-ink dark:text-gray-200">{label}</span>}
    </label>
  );
}
