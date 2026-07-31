export default function Home() {
  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: '24px', padding: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2v-5"/></svg>
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.5px' }}>SKILL<span style={{ color: 'var(--accent-primary)' }}>UP</span></h1>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '18px', textAlign: 'center', maxWidth: '480px' }}>
        Sua plataforma de aprendizado está sendo construída.
      </p>
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
        <a href="/entrar" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '12px 32px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-primary)', color: 'white', fontWeight: 600, fontSize: '14px', transition: 'background var(--transition-fast)' }}>
          Entrar
        </a>
      </div>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '48px' }}>
        © 2026 SkillUp LMS. Todos os direitos reservados.
      </p>
    </main>
  )
}
