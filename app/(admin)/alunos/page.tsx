import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Search, Plus } from 'lucide-react';

export default async function AdminAlunosPage() {
  const supabase = await createClient();

  const { data: students } = await supabase
    .from('lms_students')
    .select('id, full_name, email, role, created_at')
    .order('created_at', { ascending: false });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700 }}>Alunos e Acessos</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Gerencie os alunos matriculados e seus acessos aos cursos.
          </p>
        </div>
        
        <Button variant="primary" leftIcon={<Plus size={18} />}>
          Adicionar Aluno
        </Button>
      </header>

      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <Search size={20} color="var(--text-tertiary)" />
          <input 
            type="text" 
            placeholder="Buscar aluno por nome ou email..." 
            style={{ 
              flex: 1, 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none'
            }} 
          />
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-input)' }}>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Aluno</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Perfil (Role)</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {(!students || students.length === 0) ? (
                <tr>
                  <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    Nenhum aluno encontrado.
                  </td>
                </tr>
              ) : (
                students.map((student: any) => (
                  <tr key={student.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background var(--transition-fast)' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.full_name || 'Sem nome'}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Membro desde {new Date(student.created_at).toLocaleDateString('pt-BR')}</div>
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                      {student.email}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ 
                        padding: '4px 12px', 
                        borderRadius: 'var(--radius-pill)', 
                        fontSize: '12px', 
                        fontWeight: 600,
                        backgroundColor: student.role === 'admin' ? 'var(--accent-glow)' : 'var(--bg-input)',
                        color: student.role === 'admin' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                      }}>
                        {student.role === 'admin' ? 'Administrador' : 'Aluno'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <Button variant="secondary" style={{ padding: '8px 16px', fontSize: '12px' }}>
                        Ver Acessos
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

    </div>
  );
}
