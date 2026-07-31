import React, { ButtonHTMLAttributes, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', isLoading = false, leftIcon, rightIcon, children, disabled, style, ...props }, ref) => {
    
    const getVariantStyles = (): React.CSSProperties => {
      switch (variant) {
        case 'secondary':
          return { backgroundColor: 'var(--bg-surface, #1A1C20)', color: 'var(--text-primary, #FFFFFF)', border: '1px solid var(--border-subtle, #374151)' };
        case 'ghost':
          return { backgroundColor: 'transparent', color: 'var(--text-primary, #FFFFFF)', border: 'none' };
        case 'danger':
          return { backgroundColor: '#EF4444', color: '#FFFFFF', border: 'none' };
        case 'primary':
        default:
          return { backgroundColor: 'var(--accent-primary, #60A5FA)', color: '#FFFFFF', border: 'none' };
      }
    };

    const getSizeStyles = (): React.CSSProperties => {
      switch (size) {
        case 'sm':
          return { padding: '8px 16px', fontSize: '14px' };
        case 'lg':
          return { padding: '16px 32px', fontSize: '18px' };
        case 'md':
        default:
          return { padding: '12px 24px', fontSize: '16px' };
      }
    };

    const baseStyles: React.CSSProperties = {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8px',
      borderRadius: '999px',
      fontWeight: 600,
      cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
      opacity: disabled || isLoading ? 0.6 : 1,
      transition: 'all 0.2s ease',
      fontFamily: 'var(--font-inter, sans-serif)',
      outline: 'none',
      border: 'none',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        style={{ ...baseStyles, ...getVariantStyles(), ...getSizeStyles(), ...style }}
        {...props}
      >
        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
        {isLoading && (
          <span style={{
            display: 'inline-block',
            width: '16px',
            height: '16px',
            border: '2px solid rgba(255,255,255,0.3)',
            borderRadius: '50%',
            borderTopColor: 'currentColor',
            animation: 'spin 1s linear infinite'
          }} />
        )}
        {!isLoading && leftIcon}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';
