import React from 'react';

function hashHue(str) {
  const s = String(str || '');
  let hash = 0;
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export default function UserAvatar({ avatar, name, email, size = 40, className = '' }) {
  const hasAvatar = typeof avatar === 'string' && avatar.trim() !== '';
  const source = (name || '').trim() || (email || '').trim();
  const initial = source ? source.charAt(0).toUpperCase() : '?';
  const hue = hashHue(email || name || '?');
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
      className={className}
      style={{
        width: dimension,
        height: dimension,
        minWidth: dimension,
        minHeight: dimension,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: hasRoundedClass ? undefined : '9999px',
        backgroundColor: `hsl(${hue}, 45%, 32%)`,
        color: '#fff',
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
