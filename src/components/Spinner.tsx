import { Loader2 } from 'lucide-react';

export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={`animate-spin ${className}`} />;
}

export function FullScreenSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="min-h-screen bg-neutral-200 dark:bg-neutral-950 flex justify-center">
      <div className="relative w-full max-w-[430px] min-h-screen flex flex-col items-center justify-center bg-neutral-50 dark:bg-neutral-900 shadow-2xl gap-3">
        <Spinner size={32} className="text-primary-500" />
        <p className="text-neutral-500 dark:text-neutral-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
