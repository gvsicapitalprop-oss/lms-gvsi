'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function signInWithEmail(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  if (!email || !password) {
    return { error: 'E-mail e senha são obrigatórios.' };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: 'Credenciais inválidas. Tente novamente.' };
  }

  revalidatePath('/', 'layout');
  redirect('/dashboard');
}

export async function signInWithMagicLink(formData: FormData) {
  const email = formData.get('email') as string;
  
  if (!email) {
    return { error: 'O e-mail é obrigatório.' };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: 'Falha ao enviar o link mágico. Tente novamente.' };
  }

  return { success: 'Link mágico enviado! Verifique sua caixa de entrada.' };
}

export async function signUp(formData: FormData) {
  const fullName = formData.get('full_name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  if (!email || !password || !fullName) {
    return { error: 'Todos os campos são obrigatórios.' };
  }

  if (password.length < 6) {
    return { error: 'A senha deve ter no mínimo 6 caracteres.' };
  }

  const supabase = await createClient();
  const origin = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // We sign up the user. Note: In Supabase, signups might require email verification 
  // depending on your project settings.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      data: {
        full_name: fullName,
      },
    },
  });

  if (error) {
    return { error: 'Erro ao criar conta. Este e-mail pode já estar em uso.' };
  }

  // Se precisar de verificação de e-mail (default no Supabase)
  if (data.user && data.user.identities && data.user.identities.length === 0) {
     return { error: 'E-mail já está em uso.' };
  }

  return { success: 'Conta criada com sucesso! Verifique seu e-mail (se necessário) ou faça login.' };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/entrar');
}
