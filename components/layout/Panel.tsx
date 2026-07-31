'use client';

import React from 'react';

export interface PanelProps {
  children: React.ReactNode;
}

export const Panel: React.FC<PanelProps> = ({ children }) => {
  const panelStyle: React.CSSProperties = {
    width: 'var(--panel-width)',
    height: '100vh',
    position: 'fixed',
    right: 0,
    top: 0,
    backgroundColor: 'var(--bg-surface)',
    borderLeft: '1px solid var(--border-default)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    overflowY: 'auto',
    zIndex: 40,
  };

  return (
    <aside style={panelStyle}>
      {children}
    </aside>
  );
};
