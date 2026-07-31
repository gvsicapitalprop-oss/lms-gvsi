import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BookOpen } from 'lucide-react';
import Link from 'next/link';

export default async function CursosPage() {
  const supabase = await createClient();

  // Buscar todos os cursos publicados
  const { data: courses } = await supabase
    .from('lms_courses')
    .select('*')
    .eq('status', 'published')
    .order('menu_order', { ascending: true });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      <header>
        <h1 style={{ fontSize: '28px', fontWeight: 700 }}>
          Explorar Cursos
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
          Conheça todos os nossos cursos disponíveis e expanda seus conhecimentos.
        </p>
      </header>

      <section>
        {(!courses || courses.length === 0) ? (
          <Card padding="lg" style={{ textAlign: 'center' }}>
            <div style={{ color: 'var(--text-secondary)' }}>
              Nenhum curso disponível no momento.
            </div>
          </Card>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
            gap: '24px' 
          }}>
            {courses.map((course: any) => (
              <Card key={course.id} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: 0 }}>
                <div style={{ 
                  height: '180px', 
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
                    <Button variant="secondary" style={{ width: '100%' }} leftIcon={<BookOpen size={16} />}>
                      Ver Detalhes
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
