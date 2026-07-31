import React from 'react';

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: React.CSSProperties;
}

export const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', style }) => {
  const getInitials = (nameStr: string) => {
    return nameStr
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getSize = () => {
    switch (size) {
      case 'sm': return 32;
      case 'lg': return 56;
      case 'xl': return 80;
      case 'md':
      default: return 40;
    }
  };

  const pxSize = getSize();

  const containerStyle: React.CSSProperties = {
    width: `${pxSize}px`,
    height: `${pxSize}px`,
    borderRadius: '50%',
    backgroundColor: 'var(--accent-subtle, #1E3A5F)',
    color: 'var(--accent-primary, #60A5FA)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: `${pxSize * 0.4}px`,
    fontWeight: 600,
    overflow: 'hidden',
    flexShrink: 0,
    ...style
  };

  const imgStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  if (src) {
    return (
      <div style={containerStyle}>
        <img src={src} alt={name || 'Avatar'} style={imgStyle} />
      </div>
    );
  }

  return (
    <div style={containerStyle} aria-label={name}>
      {name ? getInitials(name) : '?'}
    </div>
  );
};
