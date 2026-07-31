'use client';

import React, { useState, useEffect } from 'react';

export interface ToastProps {
  id: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, message, type = 'info', duration = 3000, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(id), 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, id, onClose]);

  const getStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '12px 24px',
      borderRadius: 'var(--radius-pill)',
      color: 'white',
      fontWeight: 500,
      fontSize: '14px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      boxShadow: 'var(--shadow-md)',
      animation: isVisible ? 'slide-in-right 0.3s ease-out forwards' : 'fade-out 0.3s ease-out forwards',
      fontFamily: 'var(--font-inter, sans-serif)',
    };

    switch (type) {
      case 'success':
        return { ...base, backgroundColor: '#10B981' };
      case 'error':
        return { ...base, backgroundColor: '#EF4444' };
      case 'info':
      default:
        return { ...base, backgroundColor: 'var(--accent-primary)' };
    }
  };

  return (
    <div style={getStyles()}>
      {message}
    </div>
  );
};
