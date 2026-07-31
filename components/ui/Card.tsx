import React, { HTMLAttributes } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'peach' | 'blue' | 'yellow' | 'green';
  padding?: string;
  rounded?: string;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'default', padding = '24px', rounded = '24px', children, style, ...props }, ref) => {
    
    const getVariantStyles = (): React.CSSProperties => {
      switch (variant) {
        case 'peach':
          return { backgroundColor: 'var(--accent-peach, #FCE2CE)', color: '#1A1C20' };
        case 'blue':
          return { backgroundColor: 'var(--accent-light-blue, #D3EBF2)', color: '#1A1C20' };
        case 'yellow':
          return { backgroundColor: 'var(--accent-yellow, #FDF3D0)', color: '#1A1C20' };
        case 'green':
          return { backgroundColor: '#D1FAE5', color: '#1A1C20' };
        case 'default':
        default:
          return { backgroundColor: 'var(--bg-surface, #1A1C20)', color: 'var(--text-primary, #FFFFFF)' };
      }
    };

    const baseStyles: React.CSSProperties = {
      padding,
      borderRadius: rounded,
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    };

    return (
      <div
        ref={ref}
        style={{ ...baseStyles, ...getVariantStyles(), ...style }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
