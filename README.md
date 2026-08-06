# Comunidade GVSI

App da **comunidade** (chat/grupos/suporte) da GVSI para traders. Compartilha o **mesmo projeto Supabase** do LMS (tabelas com prefixo `comu_`), mas por enquanto é um **app estático (HTML + Tailwind via CDN)** separado do LMS Next.js.

> **Coexistência:** este diretório `comunidade/` vive lado a lado com o LMS (Next.js na raiz do repo) **sem se misturar**. O deploy é diferenciado no Vercel (um projeto aponta para a raiz = LMS; outro aponta para `comunidade/app` = comunidade). A fusão dos dois virá depois.

## Rodar local

```bash
cd comunidade/app
python -m http.server 8777
```

Abra <http://127.0.0.1:8777/login.html>. Precisa de internet (Tailwind e fontes via CDN).

## Estrutura

```
comunidade/
  app/                     App estático (a raiz do deploy da comunidade)
    login.html             Entrar / criar conta (Supabase Auth)
    index.html             Grupos (home)
    chat.html              Chat de um tópico (?topico=<slug>) — realtime, mídia, reações, editar/apagar
    enviar-midia.html      Upload de foto/áudio
    perfil.html            Perfil do membro (dados reais + edição)
    suporte.html           Console de atendimento (tickets) — só admin
    assets/                tailwind-config.js, app.css, topics.js, shell.js, supabase.js, auth.js
    README.md              Detalhes técnicos do app
  supabase/migrations/     Migrations das tabelas comu_* (0001..0007)
  serene_support/DESIGN.md Design system
```

## Supabase

- Projeto: `mwnyuursbrlfxfssvkyu` (o mesmo do LMS). Identidade de membro reutiliza `lms_students` (= `auth.uid()`).
- As migrations em `comunidade/supabase/migrations/` criam as tabelas `comu_*` e **dependem** do schema do LMS (usam `lms_students` e a função `lms_is_admin()`), então aplicam **depois** do core do LMS.
- No front (`app/assets/supabase.js`) fica apenas a **publishable key** (pública). A `service_role` **nunca** entra aqui.

## Deploy (Vercel)

Projeto estático apontando para **`comunidade/app`** (framework: *Other*, sem build). Entry: `login.html`/`index.html`.

## Antes de produção

- Reativar a confirmação de e-mail no Supabase (`mailer_autoconfirm` foi desativado para desenvolvimento).
- Allowlistar a URL real (Auth → Redirect URLs) para magic link / redirect.
- Trocar Tailwind/fontes do CDN por build local.

Detalhes de cada tela e do backend estão em [`app/README.md`](app/README.md).
