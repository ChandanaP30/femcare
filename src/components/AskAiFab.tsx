import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

// Floating "Ask AI" button with a label and a gentle glow and sparkle animation.
// Mounted once in the app shell, so it shows on every screen. Hidden on the chat screen itself.
export function AskAiFab({ onOpen, hidden = false }: { onOpen: () => void; hidden?: boolean }) {
  const { t } = useLanguage();
  if (hidden) return null;
  return createPortal(
    <>
      <style>{`
        @keyframes femAiGlow { 0%,100% { box-shadow: 0 0 0 0 rgba(184,161,217,.55), 0 10px 24px -8px rgba(74,53,80,.45); }
          50% { box-shadow: 0 0 0 12px rgba(184,161,217,0), 0 10px 28px -6px rgba(74,53,80,.45); } }
        @keyframes femAiSparkle { 0%,100% { opacity: 0; transform: scale(.4) rotate(0deg); }
          50% { opacity: 1; transform: scale(1) rotate(25deg); } }
        @media (prefers-reduced-motion: reduce) { .fem-ai-anim { animation: none !important; } }
      `}</style>
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('askAI')}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 5.5rem)', animation: 'femAiGlow 2.6s ease-in-out infinite' }}
        className="fem-ai-anim fixed right-4 z-40 flex w-16 flex-col items-center gap-0.5 rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-accent-500 px-2 pb-1.5 pt-2 text-white transition-transform active:scale-95"
      >
        <span className="relative flex h-7 w-7 items-center justify-center">
          <Sparkles size={22} strokeWidth={1.9} />
          <span
            className="fem-ai-anim absolute -right-1 -top-1 h-2 w-2 rounded-full bg-white"
            style={{ animation: 'femAiSparkle 1.8s ease-in-out infinite' }}
          />
        </span>
        <span className="text-[10px] font-semibold leading-tight">{t('askAI')}</span>
      </button>
    </>,
    document.body,
  );
}