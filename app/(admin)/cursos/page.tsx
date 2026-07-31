import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default async function AdminCursosPage() {
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from('lms_courses')
    .select('id, title, slug, status, menu_order, created_at')
    .order('created_at', { ascending: false });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 700 }}>Gestão de Cursos</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            Crie, edite e gerencie todos os cursos da plataforma.
          </p>
        </div>
        
        {/* Futuramente, este botão pode chamar um Server Action para criar um curso rascunho e redirecionar */}
        <Link href="/admin/cursos/novo">
          <Button variant="primary" leftIcon={<Plus size={18} />}>
            Novo Curso
          </Button>
        </Link>
      </header>

      <Card padding="none" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-input)' }}>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Curso</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ordem</th>
                <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {(!courses || courses.length === 0) ? (
                <tr>
                  <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                    Nenhum curso encontrado. Clique em "Novo Curso" para começar.
                  </td>
                </tr>
              ) : (
                courses.map((course: any) => (
                  <tr key={course.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background var(--transition-fast)' }}>
                    <td style={{ padding: '16px 24px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{course.title}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>/{course.slug}</div>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{ 
                        padding: '4px 12px', 
                        borderRadius: 'var(--radius-pill)', 
                        fontSize: '12px', 
                        fontWeight: 600,
                        backgroundColor: course.status === 'published' ? 'var(--accent-glow)' : 'var(--bg-input)',
                        color: course.status === 'published' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                      }}>
                        {course.status === 'published' ? 'Publicado' : 'Rascunho'}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                      {course.menu_order}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <Link href={`/admin/cursos/${course.id}`}>
                          <Button variant="secondary" style={{ padding: '8px', minWidth: 'auto' }}>
                            <Edit2 size={16} />
                          </Button>
                        </Link>
                        <Button variant="danger" style={{ padding: '8px', minWidth: 'auto' }}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
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
