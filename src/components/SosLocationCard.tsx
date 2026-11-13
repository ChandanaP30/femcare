import { useState } from 'react';
import { MapPin } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { SOS_OPEN_EVENT } from '@/lib/sos';
import { sosText } from '@/lib/sos-i18n';

/** "Send my location" button plus a short, expandable note about the phone's own Emergency SOS. */
export function SosLocationCard() {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);
  return (
    <section className="card space-y-3 p-4">
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(SOS_OPEN_EVENT))}
        className="btn-primary flex w-full items-center justify-center gap-2"
      >
        <MapPin size={18} strokeWidth={2} />
        {sosText(lang, 'sendLocation')}
      </button>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-ink">{sosText(lang, 'setupShort')}</p>
        <button type="button" onClick={() => setOpen((v) => !v)} className="shrink-0 text-xs font-medium text-ink underline">
          {open ? sosText(lang, 'detailsHide') : sosText(lang, 'detailsShow')}
        </button>
      </div>
      {open && <p className="text-xs leading-relaxed text-ink-muted">{sosText(lang, 'setupBody')}</p>}
    </section>
  );
}
