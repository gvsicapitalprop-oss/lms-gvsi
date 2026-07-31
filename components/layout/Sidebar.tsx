'use client';

import React from 'react';

export interface SidebarProps {
  children: React.ReactNode;
}

export const Sidebar: React.FC<SidebarProps> = ({ children }) => {
  const sidebarStyle: React.CSSProperties = {
    width: 'var(--sidebar-width)',
    height: '100vh',
    position: 'fixed',
    left: 0,
    top: 0,
    backgroundColor: 'var(--bg-surface)',
    borderRight: '1px solid var(--border-default)',
    padding: '24px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '32px',
    overflowY: 'auto',
    zIndex: 40,
  };

  return (
    <aside style={sidebarStyle}>
      <div style={{ padding: '0 8px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
          SKILL<span style={{ color: 'var(--accent-primary)' }}>UP</span>
        </h1>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
        {children}
      </nav>
    </aside>
  );
};

export const SidebarItem: React.FC<{ icon?: React.ReactNode; label: string; active?: boolean; href: string }> = ({ icon, label, active, href }) => {
  const itemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    borderRadius: 'var(--radius-pill)',
    color: active ? 'var(--text-inverted)' : 'var(--text-secondary)',
    backgroundColor: active ? 'var(--accent-primary)' : 'transparent',
    fontWeight: active ? 600 : 500,
    textDecoration: 'none',
    transition: 'all var(--transition-fast)',
  };

  return (
    <a 
      href={href} 
      style={itemStyle}
      onMouseOver={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          e.currentTarget.style.color = 'var(--text-primary)';
        }
      }}
      onMouseOut={(e) => {
        if (!active) {
          e.currentTarget.style.backgroundColor = 'transparent';
          e.currentTarget.style.color = 'var(--text-secondary)';
        }
      }}
    >
      {icon && <span style={{ display: 'flex' }}>{icon}</span>}
      <span>{label}</span>
    </a>
  );
};
