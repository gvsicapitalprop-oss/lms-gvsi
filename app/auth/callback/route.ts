import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // se houver 'next', redicionamos pra lá depois. Se não, vai pro /dashboard.
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Em caso de erro, redireciona para entrar com erro
  return NextResponse.redirect(`${origin}/entrar?error=Link%20inválido%20ou%20expirado`)
}
