import React from 'react';

export interface SkeletonProps {
  variant?: 'text' | 'circle' | 'rect';
  width?: string | number;
  height?: string | number;
  rounded?: string;
  style?: React.CSSProperties;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  rounded,
  style
}) => {
  const getStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      backgroundColor: 'var(--bg-input, #25282E)',
      backgroundImage: 'linear-gradient(90deg, var(--bg-input, #25282E) 0px, var(--bg-surface, #1A1C20) 40px, var(--bg-input, #25282E) 80px)',
      backgroundSize: '200% 100%',
      animation: 'skeleton-pulse 1.5s infinite linear',
      opacity: 0.7,
    };

    if (variant === 'circle') {
      return {
        ...base,
        width: width || '48px',
        height: height || width || '48px',
        borderRadius: '50%',
      };
    }

    if (variant === 'rect') {
      return {
        ...base,
        width: width || '100%',
        height: height || '120px',
        borderRadius: rounded || '16px',
      };
    }

    // text variant
    return {
      ...base,
      width: width || '100%',
      height: height || '20px',
      borderRadius: rounded || '4px',
      marginBottom: '8px',
    };
  };

  return (
    <>
      <style>{`
        @keyframes skeleton-pulse {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>
      <div style={{ ...getStyles(), ...style }} />
    </>
  );
};
