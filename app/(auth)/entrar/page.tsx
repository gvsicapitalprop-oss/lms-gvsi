'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail, Lock, LogIn, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { signInWithEmail, signInWithMagicLink } from '@/app/actions/auth';
import { Skeleton } from '@/components/ui/Skeleton';

function LoginForm() {
  const searchParams = useSearchParams();
  const urlError = searchParams.get('error');

  const [isLoading, setIsLoading] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [toast, setToast] = useState<{ id: string, message: string, type: 'success' | 'error' | 'info' } | null>(
    urlError ? { id: 'url-err', message: urlError, type: 'error' } : null
  );

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setToast(null);

    try {
      if (useMagicLink) {
        const res = await signInWithMagicLink(formData);
        if (res?.error) {
          setToast({ id: Date.now().toString(), message: res.error, type: 'error' });
        } else if (res?.success) {
          setToast({ id: Date.now().toString(), message: res.success, type: 'success' });
        }
      } else {
        const res = await signInWithEmail(formData);
        if (res?.error) {
          setToast({ id: Date.now().toString(), message: res.error, type: 'error' });
        }
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.5px' }}>
          SKILL<span style={{ color: 'var(--accent-primary)' }}>UP</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>
          {useMagicLink ? 'Receba um link de acesso no seu e-mail.' : 'Faça login para acessar seus cursos.'}
        </p>
      </div>

      <Card padding="lg">
        <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input 
            name="email" 
            type="email" 
            placeholder="seu@email.com" 
            label="E-mail" 
            icon={<Mail size={18} />} 
            required 
          />
          
          {!useMagicLink && (
            <Input 
              name="password" 
              type="password" 
              placeholder="••••••••" 
              label="Senha" 
              icon={<Lock size={18} />} 
              required 
            />
          )}

          <Button type="submit" isLoading={isLoading} style={{ marginTop: '8px', width: '100%' }}>
            {useMagicLink ? 'Enviar Link Mágico' : 'Entrar'}
          </Button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <button 
            type="button"
            onClick={() => setUseMagicLink(!useMagicLink)}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'var(--text-secondary)', 
              fontSize: '14px', 
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {useMagicLink ? 'Prefiro usar minha senha' : 'Entrar com Link Mágico'}
          </button>
        </div>
      </Card>

      <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
        Ainda não tem uma conta? <Link href="/cadastro" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Cadastre-se</Link>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 100 }}>
          <Toast 
            id={toast.id} 
            message={toast.message} 
            type={toast.type} 
            onClose={() => setToast(null)} 
          />
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Skeleton style={{ width: '100%', height: '400px' }} />}>
      <LoginForm />
    </Suspense>
  );
}
