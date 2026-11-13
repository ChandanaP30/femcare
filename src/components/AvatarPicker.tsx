import { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, Shuffle, X } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';
import { pt, ptDyn } from '@/lib/picker-text';
import { Avatar } from '@/components/Avatar';
import {
  BG_COLORS, DEFAULT_AVATAR_CONFIG, HAIR_COLORS, HAIR_STYLES, OUTFITS, OUTFIT_COLORS, SKIN_TONES,
  type AvatarConfig, type StoredAvatar,
} from '@/lib/avatar';

interface AvatarPickerProps {
  current: StoredAvatar | null;
  fallback: string;
  onClose: () => void;
  onSave: (next: StoredAvatar | null) => Promise<void>;
}

// Crops to a centred square, shrinks to 256px and compresses, so it stays small in the profile row.
async function fileToAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('errNotImage');
  if (file.size > 20 * 1024 * 1024) throw new Error('errTooLarge');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('errRead'));
      el.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('errRead');
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const out = 256;
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('errProcess');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, out, out);
    ctx.drawImage(img, sx, sy, side, side, 0, 0, out, out);
    let quality = 0.85;
    let data = canvas.toDataURL('image/jpeg', quality);
    while (data.length > 70000 && quality > 0.45) {
      quality -= 0.1;
      data = canvas.toDataURL('image/jpeg', quality);
    }
    return data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Swatch({ color, selected, label, onClick }: { color: string; selected: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={`h-8 w-8 rounded-full border border-black/10 transition-transform ${
        selected ? 'scale-105 ring-2 ring-primary-500 ring-offset-2 ring-offset-[rgb(var(--card))]' : 'hover:scale-105'
      }`}
      style={{ backgroundColor: color }}
    />
  );
}

function OptionChip({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        selected ? 'bg-primary-500 text-white' : 'bg-secondary-200 text-ink hover:bg-primary-100 dark:bg-white/10 dark:hover:bg-white/15'
      }`}
    >
      {label}
    </button>
  );
}

function OptionRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-2.5">{children}</div>
    </div>
  );
}

export function AvatarPicker({ current, fallback, onClose, onSave }: AvatarPickerProps) {
  const { t, lang } = useLanguage();
  const [tab, setTab] = useState<'photo' | 'avatar'>(current?.type === 'illustration' ? 'avatar' : 'photo');
  const [photo, setPhoto] = useState<string | null>(current?.type === 'photo' ? current.photo : null);
  const [config, setConfig] = useState<AvatarConfig>(current?.type === 'illustration' ? current.config : DEFAULT_AVATAR_CONFIG);
  const [busy, setBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setProcessing(true);
    try {
      setPhoto(await fileToAvatarDataUrl(file));
    } catch (err) {
      setError(ptDyn(lang, err instanceof Error ? err.message : '', pt(lang, 'errRead')));
    } finally {
      setProcessing(false);
    }
  }

  function set<K extends keyof AvatarConfig>(key: K, value: AvatarConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }));
  }

  function shuffle() {
    const pick = (n: number) => Math.floor(Math.random() * n);
    setConfig({
      skin: pick(SKIN_TONES.length),
      hairStyle: HAIR_STYLES[pick(HAIR_STYLES.length)]?.key ?? 'long',
      hairColor: pick(HAIR_COLORS.length),
      outfit: OUTFITS[pick(OUTFITS.length)]?.key ?? 'tee',
      outfitColor: pick(OUTFIT_COLORS.length),
      bg: pick(BG_COLORS.length),
    });
  }

  async function handleSave() {
    setError('');
    if (tab === 'photo' && !photo) {
      setError(pt(lang, 'errPickFirst'));
      return;
    }
    setBusy(true);
    try {
      await onSave(tab === 'photo' && photo ? { type: 'photo', photo } : { type: 'illustration', config });
      onClose();
    } catch {
      setError(pt(lang, 'errSave'));
      setBusy(false);
    }
  }

  async function handleRemove() {
    setError('');
    setBusy(true);
    try {
      await onSave(null);
      onClose();
    } catch {
      setError(pt(lang, 'errRemove'));
      setBusy(false);
    }
  }

  const preview: StoredAvatar | null = tab === 'photo' ? (photo ? { type: 'photo', photo } : null) : { type: 'illustration', config };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/55 sm:items-center sm:p-4" onClick={onClose} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={pt(lang, 'title')}
        onClick={(e) => e.stopPropagation()}
        className="card flex max-h-[92vh] w-full max-w-md flex-col overflow-hidden !rounded-b-none !p-0 sm:!rounded-3xl"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <h2 className="font-serif text-xl text-ink">{pt(lang, 'title')}</h2>
          <button type="button" onClick={onClose} aria-label={t('cancel')} className="rounded-full p-2 text-ink-muted transition-colors hover:bg-primary-50 dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-4">
          <div className="flex justify-center pt-2">
            <Avatar avatar={preview} fallback={fallback} size={112} className="ring-4 ring-primary-100 dark:ring-white/10" />
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary-200 p-1 dark:bg-white/10" role="tablist">
            {([['photo', pt(lang, 'tabPhoto')], ['avatar', pt(lang, 'tabAvatar')]] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
                className={`rounded-full py-2 text-sm font-medium transition-colors ${
                  tab === key ? 'bg-primary-500 text-white shadow-soft' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'photo' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => galleryRef.current?.click()}
                  disabled={processing || busy}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-secondary-200 px-4 py-5 text-sm font-medium text-ink transition-colors hover:bg-primary-100 disabled:opacity-60 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  <ImageIcon size={22} strokeWidth={1.75} />
                  {pt(lang, 'gallery')}
                </button>
                <button
                  type="button"
                  onClick={() => cameraRef.current?.click()}
                  disabled={processing || busy}
                  className="flex flex-col items-center gap-2 rounded-2xl bg-secondary-200 px-4 py-5 text-sm font-medium text-ink transition-colors hover:bg-primary-100 disabled:opacity-60 dark:bg-white/10 dark:hover:bg-white/15"
                >
                  <Camera size={22} strokeWidth={1.75} />
                  {pt(lang, 'takePhoto')}
                </button>
              </div>
              <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
              <input ref={cameraRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleFile} />
              <p className="text-center text-xs text-ink-muted">
                {processing ? pt(lang, 'processing') : pt(lang, 'photoHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-5">
              <button type="button" onClick={shuffle} className="mx-auto flex items-center gap-1.5 rounded-full bg-secondary-200 px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-primary-100 dark:bg-white/10 dark:hover:bg-white/15">
                <Shuffle size={14} strokeWidth={2} />
                {pt(lang, 'shuffle')}
              </button>
              <OptionRow label={pt(lang, 'skinTone')}>
                {SKIN_TONES.map((c, i) => <Swatch key={c} color={c} label={`${pt(lang, 'skinTone')} ${i + 1}`} selected={config.skin === i} onClick={() => set('skin', i)} />)}
              </OptionRow>
              <OptionRow label={pt(lang, 'hairstyle')}>
                {HAIR_STYLES.map((h) => <OptionChip key={h.key} label={ptDyn(lang, 'hair_' + h.key, h.label)} selected={config.hairStyle === h.key} onClick={() => set('hairStyle', h.key)} />)}
              </OptionRow>
              <OptionRow label={pt(lang, 'hairColor')}>
                {HAIR_COLORS.map((c, i) => <Swatch key={c} color={c} label={`${pt(lang, 'hairColor')} ${i + 1}`} selected={config.hairColor === i} onClick={() => set('hairColor', i)} />)}
              </OptionRow>
              <OptionRow label={pt(lang, 'outfit')}>
                {OUTFITS.map((o) => <OptionChip key={o.key} label={ptDyn(lang, 'outfit_' + o.key, o.label)} selected={config.outfit === o.key} onClick={() => set('outfit', o.key)} />)}
              </OptionRow>
              <OptionRow label={pt(lang, 'outfitColor')}>
                {OUTFIT_COLORS.map((c, i) => <Swatch key={c} color={c} label={`${pt(lang, 'outfitColor')} ${i + 1}`} selected={config.outfitColor === i} onClick={() => set('outfitColor', i)} />)}
              </OptionRow>
              <OptionRow label={pt(lang, 'background')}>
                {BG_COLORS.map((c, i) => <Swatch key={c} color={c} label={`${pt(lang, 'background')} ${i + 1}`} selected={config.bg === i} onClick={() => set('bg', i)} />)}
              </OptionRow>
            </div>
          )}

          {error && <p role="alert" className="text-center text-sm text-error-600 dark:text-error-300">{error}</p>}
        </div>

        <div className="flex gap-3 border-t border-primary-100 px-5 py-4 dark:border-white/10">
          {current && (
            <button type="button" onClick={handleRemove} disabled={busy || processing} className="btn-ghost">
              {pt(lang, 'remove')}
            </button>
          )}
          <button type="button" onClick={handleSave} disabled={busy || processing} className="btn-primary flex-1">
            {busy ? t('saving') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}