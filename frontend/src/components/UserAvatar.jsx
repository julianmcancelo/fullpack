import React from 'react';

function hashHue(str) {
  const s = String(str || '');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

const AVATAR_TONES = [
  'border-brand/40 bg-brand-soft text-brand-soft-ink',
  'border-success/25 bg-success-soft text-success',
  'border-accent/25 bg-accent-soft text-accent',
  'border-warning/25 bg-warning-soft text-warning',
  'border-danger/25 bg-danger-soft text-danger',
];

export default function UserAvatar({ avatar, name, email, size = 40, className = '' }) {
  const hasAvatar = typeof avatar === 'string' && avatar.trim() !== '';
  const source = (name || '').trim() || (email || '').trim();
  const initial = source ? source.charAt(0).toUpperCase() : '?';
  const tone = AVATAR_TONES[hashHue(email || name || '?') % AVATAR_TONES.length];
  const dimension = Number(size) || 40;

  if (hasAvatar) {
    return (
      <img
        src={avatar}
        alt=""
        width={dimension}
        height={dimension}
        className={className}
        style={{ width: dimension, height: dimension, objectFit: 'cover' }}
      />
    );
  }

  const hasRoundedClass = /rounded/.test(className || '');

  return (
    <span
      aria-hidden="true"
      className={`${tone} border ${className}`}
      style={{
        width: dimension,
        height: dimension,
        minWidth: dimension,
        minHeight: dimension,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: hasRoundedClass ? undefined : '9999px',
        fontWeight: 800,
        fontSize: Math.max(12, Math.round(dimension * 0.42)),
        lineHeight: 1,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {initial}
    </span>
  );
}
