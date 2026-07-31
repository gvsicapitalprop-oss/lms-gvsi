'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { User, Mail, Lock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { signUp } from '@/app/actions/auth';

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ id: string, message: string, type: 'success' | 'error' | 'info' } | null>(null);

  async function handleSubmit(formData: FormData) {
    setIsLoading(true);
    setToast(null);

    try {
      const res = await signUp(formData);
      if (res?.error) {
        setToast({ id: Date.now().toString(), message: res.error, type: 'error' });
      } else if (res?.success) {
        setToast({ id: Date.now().toString(), message: res.success, type: 'success' });
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
          Crie sua conta para começar a aprender.
        </p>
      </div>

      <Card padding="lg">
        <form action={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <Input 
            name="full_name" 
            type="text" 
            placeholder="Seu nome completo" 
            label="Nome Completo" 
            icon={<User size={18} />} 
            required 
          />

          <Input 
            name="email" 
            type="email" 
            placeholder="seu@email.com" 
            label="E-mail" 
            icon={<Mail size={18} />} 
            required 
          />
          
          <Input 
            name="password" 
            type="password" 
            placeholder="Mínimo 6 caracteres" 
            label="Senha" 
            icon={<Lock size={18} />} 
            required 
            minLength={6}
          />

          <Button type="submit" isLoading={isLoading} style={{ marginTop: '8px', width: '100%' }}>
            Criar Conta
          </Button>
        </form>
      </Card>

      <div style={{ textAlign: 'center', fontSize: '14px', color: 'var(--text-secondary)' }}>
        Já tem uma conta? <Link href="/entrar" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Faça Login</Link>
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
