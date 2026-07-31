import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Users, LayoutDashboard, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { signOut } from '@/app/actions/auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  
  // 1. Validar Sessão
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/entrar');
  }

  // 2. Validar Role (Admin)
  const { data: profile } = await supabase
    .from('lms_students')
    .select('role')
    .eq('id', user.id)
    .single();

  const profileData = profile as any;
  if (!profileData || profileData.role !== 'admin') {
    // Se não for admin, chuta de volta pro dashboard de aluno
    redirect('/dashboard');
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: 'var(--bg-main)' }}>
      
      {/* Admin Sidebar */}
      <aside style={{
        width: 'var(--sidebar-width)',
        backgroundColor: 'var(--bg-surface)',
        borderRight: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}>
        <div style={{ padding: '0 8px', marginBottom: '32px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.5px' }}>
            SKILL<span style={{ color: 'var(--accent-primary)' }}>UP</span>
          </h1>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent-primary)', fontWeight: 700, marginTop: '4px' }}>
            Painel Admin
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <Link href="/admin" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', transition: 'background var(--transition-fast)' }}>
            <LayoutDashboard size={20} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Visão Geral</span>
          </Link>
          <Link href="/admin/cursos" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', transition: 'background var(--transition-fast)' }}>
            <BookOpen size={20} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Gestão de Cursos</span>
          </Link>
          <Link href="/admin/alunos" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', transition: 'background var(--transition-fast)' }}>
            <Users size={20} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Alunos e Acessos</span>
          </Link>
          <Link href="/admin/configuracoes" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', transition: 'background var(--transition-fast)', pointerEvents: 'none', opacity: 0.5 }}>
            <Settings size={20} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>Configurações</span>
          </Link>
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <form action={signOut}>
            <button type="submit" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', width: '100%', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'color var(--transition-fast)' }}>
              <LogOut size={20} />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>Sair do Painel</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '32px 48px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
