import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PlayCircle, Lock, FileText, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default async function CoursePlayerPage({ params, searchParams }: { params: { slug: string }, searchParams: { aula?: string } }) {
  const supabase = await createClient();
  
  // 1. Verificar autenticação
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/entrar');
  }

  const courseSlug = (await params).slug;
  const aulaSlug = (await searchParams).aula;

  // 2. Buscar informações do Curso e verificar inscrição
  const { data: course } = await supabase
    .from('lms_courses')
    .select('id, title, description, thumbnail_url')
    .eq('slug', courseSlug)
    .single();

  const courseData = course as any;

  if (!courseData) {
    return <div style={{ padding: '24px' }}>Curso não encontrado.</div>;
  }

  // Verifica se o aluno tem inscrição ativa neste curso
  const { data: subscription } = await supabase
    .from('lms_subscriptions')
    .select('id')
    .eq('course_id', courseData.id)
    .eq('student_id', user.id)
    .eq('status', 'active')
    .single();

  const hasAccess = !!subscription;

  // 3. Buscar módulos e aulas
  const { data: modules } = await supabase
    .from('lms_modules')
    .select(`
      id, title, menu_order, slug,
      lms_lessons (
        id, title, slug, duration_seconds, menu_order, video_url
      )
    `)
    .eq('course_id', courseData.id)
    .order('menu_order', { ascending: true });

  // Organiza as aulas dentro dos módulos garantindo a ordem
  const sortedModules = ((modules as any) || []).map((mod: any) => ({
    ...mod,
    lms_lessons: (mod.lms_lessons || []).sort((a: any, b: any) => a.menu_order - b.menu_order)
  }));

  // Encontra a aula ativa
  let activeLesson = null;
  if (hasAccess && sortedModules.length > 0) {
    if (aulaSlug) {
      for (const mod of sortedModules) {
        const found = mod.lms_lessons.find((l: any) => l.slug === aulaSlug);
        if (found) {
          activeLesson = found;
          break;
        }
      }
    }
    // Se não encontrou pela query ou não tem query, pega a primeira do primeiro módulo
    if (!activeLesson && sortedModules[0]?.lms_lessons?.length > 0) {
      activeLesson = sortedModules[0].lms_lessons[0];
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header do Curso */}
      <div>
        <Link href="/cursos" style={{ color: 'var(--accent-primary)', fontSize: '14px', fontWeight: 600, display: 'inline-block', marginBottom: '16px' }}>
          &larr; Voltar para Cursos
        </Link>
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{courseData.title}</h1>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        
        {/* Lado Esquerdo: Player de Vídeo e Detalhes */}
        <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', gap: '24px', minWidth: '300px' }}>
          
          <Card padding="none" style={{ overflow: 'hidden', backgroundColor: '#000' }}>
            <div style={{ aspectRatio: '16/9', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111' }}>
              {!hasAccess ? (
                <div style={{ textAlign: 'center', padding: '24px' }}>
                  <Lock size={48} color="var(--text-secondary)" style={{ margin: '0 auto 16px' }} />
                  <h3 style={{ color: 'white', marginBottom: '8px' }}>Acesso Restrito</h3>
                  <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Você precisa estar matriculado para assistir as aulas.</p>
                  <Button variant="primary">Matricule-se Agora</Button>
                </div>
              ) : activeLesson ? (
                <div style={{ color: 'white', textAlign: 'center' }}>
                  <PlayCircle size={64} color="var(--accent-primary)" style={{ margin: '0 auto 16px', opacity: 0.8 }} />
                  <p>Player de Vídeo Simulado (Aula: {activeLesson.title})</p>
                  {/* Aqui entrará o Iframe real do Panda Video futuramente */}
                </div>
              ) : (
                <div style={{ color: 'var(--text-secondary)' }}>Nenhuma aula disponível neste curso.</div>
              )}
            </div>
          </Card>

          {activeLesson && (
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 600 }}>{activeLesson.title}</h2>
              <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                <Button variant="secondary" leftIcon={<FileText size={16} />}>Materiais</Button>
                <Button variant="primary" leftIcon={<CheckCircle size={16} />}>Marcar como Concluída</Button>
              </div>
            </div>
          )}
        </div>

        {/* Lado Direito: Trilha de Módulos (Playlist) */}
        <div style={{ flex: '1 1 35%', minWidth: '300px' }}>
          <Card padding="md">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-default)' }}>
              Conteúdo do Curso
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {sortedModules.map((mod: any, index: number) => (
                <div key={mod.id}>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '8px', color: 'var(--text-primary)' }}>
                    Módulo {index + 1}: {mod.title}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {mod.lms_lessons.map((lesson: any) => {
                      const isActive = activeLesson?.id === lesson.id;
                      return (
                        <Link 
                          key={lesson.id} 
                          href={`/cursos/${courseSlug}?aula=${lesson.slug}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
                            backgroundColor: isActive ? 'var(--accent-glow)' : 'transparent',
                            color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            fontWeight: isActive ? 600 : 400,
                            borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
                            transition: 'all 0.2s ease',
                            pointerEvents: hasAccess ? 'auto' : 'none',
                            opacity: hasAccess ? 1 : 0.6
                          }}
                        >
                          {hasAccess ? <PlayCircle size={16} /> : <Lock size={16} />}
                          <span style={{ fontSize: '14px', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {lesson.title}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
              
              {sortedModules.length === 0 && (
                <p style={{ color: 'var(--text-tertiary)', fontSize: '14px', textAlign: 'center' }}>
                  Este curso ainda não possui módulos cadastrados.
                </p>
              )}
            </div>
          </Card>
        </div>

      </div>
    </div>
  );
}
