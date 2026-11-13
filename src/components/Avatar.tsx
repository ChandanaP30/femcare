import {
  BG_COLORS, HAIR_COLORS, OUTFIT_COLORS, SKIN_TONES,
  type AvatarConfig, type HairStyle, type OutfitStyle, type StoredAvatar,
} from '@/lib/avatar';

const CAP = 'M38 52 C34 32 48 23 60 23 C72 23 86 32 82 52 C80 43 72 37 60 36 C48 37 40 43 38 52 Z';
const BODY_PATH = 'M12 120 C12 100 34 89 60 89 C86 89 108 100 108 120 Z';

function HairBack({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'long':
      return <path d="M35 54 C28 28 44 20 60 20 C76 20 92 28 85 54 L89 96 C80 102 40 102 31 96 Z" fill={color} />;
    case 'bob':
      return <path d="M35 56 C29 30 44 21 60 21 C76 21 91 30 85 56 L87 76 C80 80 40 80 33 76 Z" fill={color} />;
    case 'curly':
      return (
        <g fill={color}>
          <circle cx="34" cy="42" r="10" /><circle cx="30" cy="56" r="10" /><circle cx="36" cy="68" r="9" />
          <circle cx="86" cy="42" r="10" /><circle cx="90" cy="56" r="10" /><circle cx="84" cy="68" r="9" />
          <circle cx="46" cy="25" r="11" /><circle cx="60" cy="21" r="11" /><circle cx="74" cy="25" r="11" />
        </g>
      );
    case 'bun':
      return <circle cx="60" cy="15" r="11" fill={color} />;
    case 'ponytail':
      return <path d="M78 36 C100 34 104 66 94 92 C92 78 86 66 78 58 Z" fill={color} />;
    default:
      return null;
  }
}

function HairFront({ style, color }: { style: HairStyle; color: string }) {
  switch (style) {
    case 'bob':
      return (
        <g fill={color}>
          <path d="M37 50 C35 31 49 22 60 22 C71 22 85 31 83 50 C75 41 45 41 37 50 Z" />
          <path d="M36 50 L34 74 Q39 78 45 75 L43 52 Z" />
          <path d="M84 50 L86 74 Q81 78 75 75 L77 52 Z" />
        </g>
      );
    case 'long':
      return (
        <g fill={color}>
          <path d={CAP} />
          <path d="M35 52 C31 70 31 90 38 102 L48 98 C42 86 42 70 42 56 Z" />
          <path d="M85 52 C89 70 89 90 82 102 L72 98 C78 86 78 70 78 56 Z" />
        </g>
      );
    case 'curly':
      return (
        <g fill={color}>
          <circle cx="46" cy="33" r="7" /><circle cx="57" cy="29" r="7.5" /><circle cx="69" cy="30" r="7.5" />
          <circle cx="78" cy="37" r="6" /><circle cx="41" cy="41" r="5.5" />
        </g>
      );
    case 'ponytail':
      return (
        <g>
          <path d={CAP} fill={color} />
          <circle cx="80" cy="43" r="3.2" fill="#E87BA0" />
        </g>
      );
    default:
      return <path d={CAP} fill={color} />;
  }
}

function OutfitDetails({ style, color, skin }: { style: OutfitStyle; color: string; skin: string }) {
  switch (style) {
    case 'hoodie':
      return (
        <g>
          <path d="M42 89 Q60 104 78 89 L83 93 Q60 118 37 93 Z" fill="rgba(0,0,0,0.18)" />
          <path d="M49 89 Q60 99 71 89 Z" fill={skin} />
          <path d="M55 98 L54 111 M65 98 L66 111" stroke="rgba(255,255,255,0.9)" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'sweater':
      return (
        <g>
          <rect x="49" y="76" width="22" height="15" rx="6" fill={color} />
          <rect x="49" y="76" width="22" height="15" rx="6" fill="rgba(0,0,0,0.1)" />
          <path d="M52 82 H68 M52 86 H68" stroke="rgba(0,0,0,0.18)" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </g>
      );
    case 'dress':
      return (
        <g>
          <path d="M45 89 Q60 110 75 89 Z" fill={skin} />
          <circle cx="60" cy="102" r="2" fill="#F4D58D" />
        </g>
      );
    case 'kurta':
      return (
        <g>
          <path d="M52 89 L60 100 L68 89 Z" fill={skin} />
          <path d="M50 89 L60 102 L70 89" stroke="#F4D58D" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
          <path d="M60 102 L60 120" stroke="#F4D58D" strokeWidth="1.2" />
          <circle cx="60" cy="108" r="1.2" fill="#F4D58D" />
          <circle cx="60" cy="114" r="1.2" fill="#F4D58D" />
        </g>
      );
    default:
      return (
        <g>
          <path d="M48 89 Q60 102 72 89 Z" fill={skin} />
          <path d="M48 89 Q60 102 72 89" fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1.2" />
        </g>
      );
  }
}

export function AvatarArt({ config, className }: { config: AvatarConfig; className?: string }) {
  const skin = SKIN_TONES[config.skin] ?? SKIN_TONES[0];
  const hair = HAIR_COLORS[config.hairColor] ?? HAIR_COLORS[0];
  const outfit = OUTFIT_COLORS[config.outfitColor] ?? OUTFIT_COLORS[0];
  const bg = BG_COLORS[config.bg] ?? BG_COLORS[0];
  const ink = '#3B2A33';

  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="fc-avatar-clip"><circle cx="60" cy="60" r="60" /></clipPath>
      </defs>
      <g clipPath="url(#fc-avatar-clip)">
      <circle cx="60" cy="60" r="60" fill={bg} />
      <HairBack style={config.hairStyle} color={hair} />
      <path d={BODY_PATH} fill={outfit} />
      <rect x="52" y="66" width="16" height="24" fill={skin} />
      <rect x="52" y="74" width="16" height="7" fill="rgba(0,0,0,0.10)" />
      <OutfitDetails style={config.outfit} color={outfit} skin={skin} />
      <circle cx="38.5" cy="55" r="4.2" fill={skin} />
      <circle cx="81.5" cy="55" r="4.2" fill={skin} />
      <ellipse cx="60" cy="52" rx="21.5" ry="24" fill={skin} />
      <circle cx="45" cy="62" r="4" fill="#F28B95" opacity="0.35" />
      <circle cx="75" cy="62" r="4" fill="#F28B95" opacity="0.35" />
      <path d="M46.5 47.5 Q51 45 55.5 47.5 M64.5 47.5 Q69 45 73.5 47.5" stroke={ink} strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <ellipse cx="51" cy="54" rx="2.6" ry="3.4" fill={ink} />
      <ellipse cx="69" cy="54" rx="2.6" ry="3.4" fill={ink} />
      <circle cx="52" cy="52.8" r="0.9" fill="#fff" />
      <circle cx="70" cy="52.8" r="0.9" fill="#fff" />
      <path d="M60 58 Q58.5 61 60.5 61.5" stroke={ink} strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M53.5 65 Q60 70.5 66.5 65" stroke="#8A3B4A" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      <HairFront style={config.hairStyle} color={hair} />
      </g>
    </svg>
  );
}

interface AvatarProps {
  avatar: StoredAvatar | null;
  /** Letter shown when no picture or avatar is saved. */
  fallback: string;
  size?: number;
  className?: string;
}

export function Avatar({ avatar, fallback, size = 64, className = '' }: AvatarProps) {
  const dims = { width: size, height: size };
  const base = `relative shrink-0 overflow-hidden rounded-full ${className}`;

  if (avatar?.type === 'photo') {
    return (
      <span className={`${base} block`} style={dims}>
        <img src={avatar.photo} alt="Profile picture" className="block h-full w-full rounded-full object-cover" draggable={false} />
      </span>
    );
  }
  if (avatar?.type === 'illustration') {
    return (
      <span className={`${base} block`} style={dims}>
        <AvatarArt config={avatar.config} className="block h-full w-full" />
      </span>
    );
  }
  return (
    <span
      className={`${base} flex items-center justify-center bg-primary-200 font-serif text-ink-onlight dark:bg-primary-900/60 dark:text-primary-100`}
      style={{ ...dims, fontSize: Math.round(size * 0.4) }}
    >
      {fallback}
    </span>
  );
}