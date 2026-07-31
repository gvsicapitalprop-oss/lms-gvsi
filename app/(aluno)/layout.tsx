import React from 'react';
import { Sidebar, SidebarItem } from '@/components/layout/Sidebar';
import { Panel } from '@/components/layout/Panel';
import { Avatar } from '@/components/ui/Avatar';
import { ProgressRing } from '@/components/ui/ProgressRing';

export default function AlunoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      {/* Esquerda: Sidebar Principal */}
      <Sidebar>
        <SidebarItem label="Dashboard" href="/dashboard" active />
        <SidebarItem label="Meus Cursos" href="/cursos" />
        <SidebarItem label="Comunidade" href="/comunidade" />
        <SidebarItem label="Certificados" href="/certificados" />
        <SidebarItem label="Configurações" href="/configuracoes" />
      </Sidebar>

      {/* Centro: Conteúdo Fluido */}
      <main style={{ 
        flex: 1, 
        marginLeft: 'var(--sidebar-width)', 
        marginRight: 'var(--panel-width)',
        padding: '32px 48px',
        maxWidth: '1200px'
      }}>
        {children}
      </main>

      {/* Direita: Painel Contextual */}
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', paddingBottom: '24px', borderBottom: '1px solid var(--border-default)' }}>
          <Avatar name="João Silva" size="md" />
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>João Silva</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Aluno PRO</div>
          </div>
        </div>
        
        <div style={{ marginTop: '16px' }}>
          <h3 style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '16px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Seu Progresso</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', backgroundColor: 'var(--bg-main)', padding: '16px', borderRadius: 'var(--radius-lg)' }}>
            <ProgressRing value={65} size={48} strokeWidth={4} label="65%" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Trilha Frontend</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>4 de 12 aulas</div>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
