import React from 'react';

export type AvatarStyle = 'classic' | 'fire' | 'chrome' | 'neon';

const AVATAR_COLORS = [
  '#e53e3e', '#dd6b20', '#d69e2e', '#38a169', '#3182ce',
  '#805ad5', '#d53f8c', '#00b5d8', '#2d3748', '#718096',
];

function hashColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

interface CarAvatarProps {
  carNumber?: string | null;
  avatarStyle?: string | null;
  userId?: string;
  size?: number;
  className?: string;
}

export function CarAvatar({ carNumber, avatarStyle, userId = '', size = 36, className = '' }: CarAvatarProps) {
  const num = (carNumber ?? '').trim() || '?';
  const style = (avatarStyle ?? 'classic') as AvatarStyle;
  const baseColor = hashColor(userId);
  const fontSize = num.length === 1 ? size * 0.52 : size * 0.38;
  const id = `av-${userId.slice(0, 8)}-${style}`;

  let bgContent: React.ReactNode;
  let textFill = '#fff';
  let textStroke = '';

  if (style === 'fire') {
    bgContent = (
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffd700" />
          <stop offset="50%" stopColor="#ff6b2b" />
          <stop offset="100%" stopColor="#c0392b" />
        </linearGradient>
      </defs>
    );
    textFill = '#fff';
    textStroke = 'rgba(0,0,0,0.4)';
  } else if (style === 'chrome') {
    bgContent = (
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#e8e8e8" />
          <stop offset="40%" stopColor="#a0a0a0" />
          <stop offset="60%" stopColor="#c8c8c8" />
          <stop offset="100%" stopColor="#707070" />
        </linearGradient>
      </defs>
    );
    textFill = '#1a1a1a';
    textStroke = '';
  } else if (style === 'neon') {
    bgContent = (
      <defs>
        <linearGradient id={`${id}-grad`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0f0f0f" />
          <stop offset="100%" stopColor="#1a1a2e" />
        </linearGradient>
        <filter id={`${id}-glow`}>
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    );
    textFill = '#ff6b2b';
  } else {
    // classic
    bgContent = null;
  }

  const gradId = `${id}-grad`;
  const bgFill = style === 'classic' ? baseColor : `url(#${gradId})`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      className={className}
      style={{ display: 'inline-block', flexShrink: 0 }}
    >
      {bgContent}
      <rect x="0" y="0" width="36" height="36" rx="6" fill={bgFill} />
      {style === 'neon' && (
        <rect x="1" y="1" width="34" height="34" rx="5" fill="none" stroke="#ff6b2b" strokeWidth="1.5" opacity="0.8" />
      )}
      <text
        x="18"
        y="18"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight="900"
        fontFamily="'Arial Black', Arial, sans-serif"
        fill={textFill}
        stroke={textStroke || undefined}
        strokeWidth={textStroke ? 0.5 : undefined}
        filter={style === 'neon' ? `url(#${id}-glow)` : undefined}
        letterSpacing="-0.5"
      >
        {num}
      </text>
    </svg>
  );
}

export function getInitialsAvatar(displayName: string | null, size = 36): React.ReactNode {
  const name = displayName ?? '?';
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const color = hashColor(name);
  const fontSize = initials.length === 1 ? size * 0.45 : size * 0.35;
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" style={{ display: 'inline-block', flexShrink: 0 }}>
      <rect x="0" y="0" width="36" height="36" rx="18" fill={color} />
      <text x="18" y="18" textAnchor="middle" dominantBaseline="central"
        fontSize={fontSize} fontWeight="700" fontFamily="Arial, sans-serif" fill="#fff">
        {initials}
      </text>
    </svg>
  );
}
