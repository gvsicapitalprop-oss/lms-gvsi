import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'SkillUp LMS — Sua plataforma de aprendizado',
  description: 'Aprenda no seu ritmo com cursos online de alta qualidade. Acesse aulas em vídeo, materiais complementares e participe da comunidade.',
  keywords: ['cursos online', 'educação', 'aprendizado', 'lms', 'plataforma'],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
