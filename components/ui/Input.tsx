import React, { InputHTMLAttributes, ReactNode } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, style, className, ...props }, ref) => {
    const containerStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      width: '100%',
      fontFamily: 'var(--font-inter, sans-serif)',
    };

    const labelStyle: React.CSSProperties = {
      fontSize: '14px',
      fontWeight: 500,
      color: 'var(--text-primary, #FFFFFF)',
    };

    const inputWrapperStyle: React.CSSProperties = {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
    };

    const inputStyle: React.CSSProperties = {
      width: '100%',
      padding: '12px 24px',
      paddingLeft: icon ? '48px' : '24px',
      borderRadius: '999px',
      backgroundColor: 'var(--bg-input, #25282E)',
      border: error ? '1px solid #EF4444' : '1px solid transparent',
      color: 'var(--text-primary, #FFFFFF)',
      fontSize: '16px',
      outline: 'none',
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      ...(style || {})
    };

    const iconStyle: React.CSSProperties = {
      position: 'absolute',
      left: '16px',
      color: 'var(--text-secondary, #8C9097)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    };

    const messageStyle: React.CSSProperties = {
      fontSize: '12px',
      color: error ? '#EF4444' : 'var(--text-secondary, #8C9097)',
      marginTop: '4px',
      paddingLeft: '12px',
    };

    return (
      <div style={containerStyle} className={className}>
        {label && <label style={labelStyle}>{label}</label>}
        <div style={inputWrapperStyle}>
          {icon && <span style={iconStyle}>{icon}</span>}
          <input
            ref={ref}
            style={inputStyle}
            {...props}
          />
        </div>
        {(error || hint) && (
          <span style={messageStyle}>{error || hint}</span>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
