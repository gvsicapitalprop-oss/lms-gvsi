import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { Users, BookOpen, PlayCircle } from 'lucide-react';

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Buscar totais básicos
  const { count: studentsCount } = await supabase
    .from('lms_students')
    .select('*', { count: 'exact', head: true });

  const { count: coursesCount } = await supabase
    .from('lms_courses')
    .select('*', { count: 'exact', head: true });

  const { count: activeSubsCount } = await supabase
    .from('lms_subscriptions')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <header>
        <h1 style={{ fontSize: '32px', fontWeight: 700 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Visão geral do desempenho da sua plataforma.
        </p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
        <Card variant="peach" padding="lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-on-pastel)', opacity: 0.7, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total de Alunos
              </div>
              <div style={{ color: 'var(--text-on-pastel)', fontSize: '36px', fontWeight: 800, marginTop: '8px' }}>
                {studentsCount || 0}
              </div>
            </div>
            <Users size={32} color="var(--text-on-pastel)" style={{ opacity: 0.3 }} />
          </div>
        </Card>

        <Card variant="blue" padding="lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-on-pastel)', opacity: 0.7, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Cursos Criados
              </div>
              <div style={{ color: 'var(--text-on-pastel)', fontSize: '36px', fontWeight: 800, marginTop: '8px' }}>
                {coursesCount || 0}
              </div>
            </div>
            <BookOpen size={32} color="var(--text-on-pastel)" style={{ opacity: 0.3 }} />
          </div>
        </Card>

        <Card variant="green" padding="lg">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ color: 'var(--text-on-pastel)', opacity: 0.7, fontSize: '14px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Matrículas Ativas
              </div>
              <div style={{ color: 'var(--text-on-pastel)', fontSize: '36px', fontWeight: 800, marginTop: '8px' }}>
                {activeSubsCount || 0}
              </div>
            </div>
            <PlayCircle size={32} color="var(--text-on-pastel)" style={{ opacity: 0.3 }} />
          </div>
        </Card>
      </section>
      
      <section>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>Últimas Atividades</h2>
        <Card>
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px' }}>
            Nenhuma atividade recente registrada no painel.
          </div>
        </Card>
      </section>

    </div>
  );
}
