export type HairStyle = 'short' | 'bob' | 'long' | 'curly' | 'bun' | 'ponytail';
export type OutfitStyle = 'tee' | 'hoodie' | 'sweater' | 'dress' | 'kurta';

export interface AvatarConfig {
  skin: number;
  hairStyle: HairStyle;
  hairColor: number;
  outfit: OutfitStyle;
  outfitColor: number;
  bg: number;
}

export type StoredAvatar =
  | { type: 'photo'; photo: string }
  | { type: 'illustration'; config: AvatarConfig };

export const SKIN_TONES = ['#FBE3D3', '#F5CDB0', '#E5AD84', '#C98B5B', '#A56A43', '#7B4B2E', '#52311F'];
export const HAIR_COLORS = ['#231815', '#4B2E22', '#7B4B2A', '#B4642B', '#D8A85A', '#9A9AA5', '#C9507A', '#7C5CD6'];
export const OUTFIT_COLORS = ['#D9739A', '#9672CF', '#4FA08B', '#E0A04A', '#4F7FD1', '#E26D6D', '#EFE8F4'];
export const BG_COLORS = ['#F4DCE5', '#E4DBF1', '#D6EDE6', '#FBE7C6', '#D5E3F7', '#3A2D40'];

export const HAIR_STYLES: { key: HairStyle; label: string }[] = [
  { key: 'short', label: 'Short' },
  { key: 'bob', label: 'Bob' },
  { key: 'long', label: 'Long' },
  { key: 'curly', label: 'Curly' },
  { key: 'bun', label: 'Bun' },
  { key: 'ponytail', label: 'Ponytail' },
];

export const OUTFITS: { key: OutfitStyle; label: string }[] = [
  { key: 'tee', label: 'T-shirt' },
  { key: 'hoodie', label: 'Hoodie' },
  { key: 'sweater', label: 'Sweater' },
  { key: 'dress', label: 'Dress' },
  { key: 'kurta', label: 'Kurta' },
];

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  skin: 2,
  hairStyle: 'long',
  hairColor: 1,
  outfit: 'tee',
  outfitColor: 0,
  bg: 1,
};

function clampIndex(v: unknown, len: number, fallback: number): number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < len ? v : fallback;
}

export function sanitizeConfig(raw: unknown): AvatarConfig {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_AVATAR_CONFIG;
  return {
    skin: clampIndex(r.skin, SKIN_TONES.length, d.skin),
    hairStyle: HAIR_STYLES.some((h) => h.key === r.hairStyle) ? (r.hairStyle as HairStyle) : d.hairStyle,
    hairColor: clampIndex(r.hairColor, HAIR_COLORS.length, d.hairColor),
    outfit: OUTFITS.some((o) => o.key === r.outfit) ? (r.outfit as OutfitStyle) : d.outfit,
    outfitColor: clampIndex(r.outfitColor, OUTFIT_COLORS.length, d.outfitColor),
    bg: clampIndex(r.bg, BG_COLORS.length, d.bg),
  };
}

/** Reads the saved avatar out of profile.preferences. Returns null when nothing valid is saved. */
export function readAvatar(preferences: unknown): StoredAvatar | null {
  if (!preferences || typeof preferences !== 'object') return null;
  const a = (preferences as Record<string, unknown>).avatar;
  if (!a || typeof a !== 'object') return null;
  const rec = a as Record<string, unknown>;
  if (rec.type === 'photo' && typeof rec.photo === 'string' && rec.photo.startsWith('data:image/')) {
    return { type: 'photo', photo: rec.photo };
  }
  if (rec.type === 'illustration') {
    return { type: 'illustration', config: sanitizeConfig(rec.config) };
  }
  return null;
}