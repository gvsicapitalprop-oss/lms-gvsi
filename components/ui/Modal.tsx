'use client';

import React, { useEffect, useRef } from 'react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer }) => {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const backdropStyle: React.CSSProperties = {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 16, 18, 0.75)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    padding: '16px',
    animation: 'fadeIn 0.2s ease',
  };

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'var(--bg-surface, #1A1C20)',
    borderRadius: '24px',
    width: '100%',
    maxWidth: '500px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: '24px',
    borderBottom: '1px solid var(--bg-input, #25282E)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const titleStyle: React.CSSProperties = {
    margin: 0,
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text-primary, #FFFFFF)',
  };

  const closeBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary, #8C9097)',
    cursor: 'pointer',
    fontSize: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    transition: 'background 0.2s',
  };

  const contentStyle: React.CSSProperties = {
    padding: '24px',
    overflowY: 'auto',
    color: 'var(--text-secondary, #8C9097)',
  };

  const footerStyle: React.CSSProperties = {
    padding: '24px',
    borderTop: '1px solid var(--bg-input, #25282E)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
  };

  return (
    <div style={backdropStyle} onClick={handleBackdropClick} role="dialog" aria-modal="true">
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      <div style={modalStyle} ref={modalRef} tabIndex={-1}>
        <div style={headerStyle}>
          {title && <h2 style={titleStyle}>{title}</h2>}
          <button 
            style={closeBtnStyle} 
            onClick={onClose}
            aria-label="Fechar"
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-input, #25282E)'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            &times;
          </button>
        </div>
        <div style={contentStyle}>
          {children}
        </div>
        {footer && (
          <div style={footerStyle}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
