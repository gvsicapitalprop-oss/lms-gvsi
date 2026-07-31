import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Play } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  
  // 1. Verificar usuário logado
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/entrar');
  }

  // 2. Buscar dados do perfil do aluno
  const { data: profile } = await supabase
    .from('lms_students')
    .select('*')
    .eq('id', user.id)
    .single();

  const firstName = profile?.full_name?.split(' ')[0] || 'Aluno';

  // 3. Buscar inscrições (cursos) do aluno
  const { data: subscriptions } = await supabase
    .from('lms_subscriptions')
    .select(`
      id,
      course_id,
      lms_courses (
        id,
        title,
        description,
        thumbnail_url,
        slug
      )
    `)
    .eq('student_id', user.id)
    .eq('status', 'active');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <header>
        <h1 style={{ fontSize: '28px', fontWeight: 700 }}>
          Olá, {firstName}! 👋
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Que bom ter você de volta. Pronto para continuar aprendendo?
        </p>
      </header>

      <section>
        <h2 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '16px' }}>
          Seus Cursos Recentes
        </h2>
        
        {(!subscriptions || subscriptions.length === 0) ? (
          <Card padding="lg" style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '16px', color: 'var(--text-secondary)' }}>
              Você ainda não está matriculado em nenhum curso.
            </div>
            <Link href="/cursos">
              <Button variant="primary">Explorar Cursos</Button>
            </Link>
          </Card>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '24px' 
          }}>
            {subscriptions.map((sub: any) => {
              const course = sub.lms_courses;
              return (
                <Card key={sub.id} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                  <div style={{ 
                    height: '160px', 
                    backgroundColor: 'var(--bg-input)',
                    backgroundImage: course.thumbnail_url ? `url(${course.thumbnail_url})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderBottom: '1px solid var(--border-default)'
                  }} />
                  <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>
                      {course.title}
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', flex: 1 }}>
                      {course.description || 'Nenhuma descrição informada.'}
                    </p>
                    <Link href={`/cursos/${course.slug}`}>
                      <Button style={{ width: '100%' }} leftIcon={<Play size={16} />}>
                        Continuar
                      </Button>
                    </Link>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
