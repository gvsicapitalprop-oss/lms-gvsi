# GVSI Comunidade — App

Protótipo da comunidade GVSI (traders). **Sem dados de mockup**, **responsivo (mobile + desktop)** e com **modo claro/escuro** — base pronta para virar sistema real (fase 2).

## Como rodar (local)

Servidor estático simples a partir desta pasta (`app/`):

```bash
python -m http.server 8777
```

Abra <http://127.0.0.1:8777/index.html>. Qualquer servidor estático serve (Live Server, `npx serve`, etc.). Precisa de internet (Tailwind e fontes via CDN nesta fase).

## Estrutura

```
app/
  login.html          Entrar / criar conta / link mágico (Supabase Auth)
  index.html          Home — grupos (sidebar no desktop / lista no mobile)
  chat.html           Conversa de um tópico (?topico=<id>)
  enviar-midia.html   Envio de foto/áudio (?topico=<id>)
  perfil.html         Perfil do membro + recursos + conquistas
  assets/
    tailwind-config.js  Tema do Tailwind (cores apontam para CSS variables)
    app.css             Design tokens light/dark + estilos compartilhados
    topics.js           Lista de tópicos (fallback estático; DB é a fonte real)
    shell.js            Renderiza tópicos, marca ativo, alterna tema, busca
    supabase.js         Cria o cliente Supabase (chave publishable)
    auth.js             Guarda as páginas (data-app), login/logout, perfil
```

## Autenticação (Supabase Auth) — ligada

- Páginas com `data-app` exigem sessão; sem login, redirecionam para `login.html`.
- Identidade = `lms_students` (mesmo `auth` do LMS). No 1º login o perfil é criado
  automaticamente (`ensureProfile` → upsert em `lms_students`).
- Chave **publishable** no front (`assets/supabase.js`); a `service_role` nunca entra aqui.
- ⚠️ A confirmação de e-mail está **desativada** (`mailer_autoconfirm`) para facilitar o
  desenvolvimento — **reative antes do lançamento**.

Os `code.html` originais (com mockup) ficaram nas pastas irmãs como referência; o design system está em `../serene_support/DESIGN.md`.

## Responsividade

- **Desktop (≥ 1024px):** layout de duas colunas estilo WhatsApp Web — **sidebar fixa (360px)** com a lista de tópicos + rodapé (perfil e tema), e a área principal à direita.
- **Mobile (< 1024px):** fluxo de telas separadas com header no topo e navegação inferior (Grupos / Meu Perfil). A sidebar some.

## Modo claro/escuro

- Tokens de cor ficam em CSS variables (`assets/app.css`) e trocam via classe `.dark` no `<html>` — tudo (incluindo opacidades tipo `bg-primary/20`) alterna de uma vez.
- Botão de alternância: no **rodapé da sidebar** (desktop) e no **topo à direita** (mobile).
- Na primeira visita segue a preferência do sistema (`prefers-color-scheme`); depois lembra a escolha (localStorage `gvsi-theme`). Um script no `<head>` aplica o tema antes de pintar (sem "flash").

## Navegação

| De | Ação | Para |
|----|------|------|
| Home/Sidebar | tópico | `chat.html?topico=<id>` |
| Chat | anexar / câmera | `enviar-midia.html?topico=<id>` |
| Enviar Mídia | fechar / enviar | volta ao Chat de origem |
| Sidebar / nav | Perfil ↔ Grupos | `perfil.html` / `index.html` |

Tópicos (em `topics.js`): `prints`, `tutoriais`, `suporte`, `geral`, `resultados`, `recados`, `desafio`, `arquivos`.

## Fase 2 — Sistema 100% real (planejado)

- **Backend:** Supabase (projeto `mwnyuursbrlfxfssvkyu`). Tabelas da comunidade com prefixo **`comu_`** (as existentes usam `lms_`, e já há um bloco `lms_community_*` a alinhar). Acesso via **Supabase CLI / Management API** — nunca a `service_role` no front.
- **Dados reais:** `comu_topics` (alimenta `topics.js`), `comu_messages` (chat), `comu_media`, `comu_profiles`, `comu_achievements`.
- **Auth:** login do membro (Supabase Auth) preenchendo o perfil.
- **Build:** trocar o Tailwind CDN por build local (Tailwind CLI/Vite) e auto-hospedar as fontes.
