-- =====================================================================
-- GVSI Comunidade — schema do chat (prefixo comu_)
-- ADITIVO: cria apenas tabelas comu_*. NÃO altera nenhuma tabela lms_*.
-- Identidade de membro reutiliza public.lms_students(id) (= auth.uid()).
-- RLS/auth espelham as tabelas lms_* (auth.uid(), lms_is_admin()).
-- =====================================================================

-- 1) Tópicos / canais do chat -----------------------------------------
create table if not exists public.comu_topics (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  name         text not null,
  description  text,
  icon         text,                         -- nome do Material Symbol
  tone         text not null default 'primary'
               check (tone in ('primary','secondary','tertiary')),
  position     integer not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- 2) Mensagens --------------------------------------------------------
create table if not exists public.comu_messages (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references public.comu_topics(id)   on delete cascade,
  author_id    uuid not null references public.lms_students(id)  on delete cascade,
  kind         text not null default 'text'
               check (kind in ('text','image','audio','file','system')),
  body         text,
  media_url    text,
  media_meta   jsonb not null default '{}'::jsonb,  -- {duration,width,height,mime,size}
  reply_to_id  uuid references public.comu_messages(id) on delete set null,
  status       text not null default 'sent'
               check (status in ('sent','edited','deleted')),
  edited_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint comu_messages_has_content check (
    body is not null or media_url is not null or kind = 'system'
  )
);
create index if not exists comu_messages_topic_created_idx on public.comu_messages (topic_id, created_at desc);
create index if not exists comu_messages_author_idx        on public.comu_messages (author_id);

-- 3) Reações em mensagens --------------------------------------------
create table if not exists public.comu_message_reactions (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid not null references public.comu_messages(id) on delete cascade,
  user_id      uuid not null references public.lms_students(id)  on delete cascade,
  reaction     text not null default 'like',
  created_at   timestamptz not null default now(),
  unique (message_id, user_id, reaction)
);
create index if not exists comu_message_reactions_message_idx on public.comu_message_reactions (message_id);

-- 4) Marcação de leitura (para "não lidas") ---------------------------
create table if not exists public.comu_topic_reads (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references public.comu_topics(id)  on delete cascade,
  user_id      uuid not null references public.lms_students(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  unique (topic_id, user_id)
);

-- updated_at automático ----------------------------------------------
create or replace function public.comu_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists comu_topics_updated_at on public.comu_topics;
create trigger comu_topics_updated_at before update on public.comu_topics
  for each row execute function public.comu_set_updated_at();

drop trigger if exists comu_messages_updated_at on public.comu_messages;
create trigger comu_messages_updated_at before update on public.comu_messages
  for each row execute function public.comu_set_updated_at();

-- RLS -----------------------------------------------------------------
alter table public.comu_topics            enable row level security;
alter table public.comu_messages          enable row level security;
alter table public.comu_message_reactions enable row level security;
alter table public.comu_topic_reads       enable row level security;

-- Tópicos: leitura p/ autenticados; escrita só admin
create policy "Tópicos: leitura" on public.comu_topics
  for select to authenticated using (is_active or lms_is_admin());
create policy "Tópicos: admin gerencia" on public.comu_topics
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

-- Mensagens
create policy "Mensagens: leitura" on public.comu_messages
  for select to authenticated
  using (status <> 'deleted' or (select auth.uid()) = author_id or lms_is_admin());
create policy "Mensagens: criar" on public.comu_messages
  for insert to authenticated with check ((select auth.uid()) = author_id);
create policy "Mensagens: editar própria" on public.comu_messages
  for update to authenticated
  using ((select auth.uid()) = author_id or lms_is_admin())
  with check ((select auth.uid()) = author_id or lms_is_admin());
create policy "Mensagens: remover própria" on public.comu_messages
  for delete to authenticated
  using ((select auth.uid()) = author_id or lms_is_admin());

-- Reações
create policy "Reações: ver" on public.comu_message_reactions
  for select to authenticated using (true);
create policy "Reações: criar" on public.comu_message_reactions
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Reações: remover própria" on public.comu_message_reactions
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Leitura de tópicos (por usuário)
create policy "Leituras: ver própria" on public.comu_topic_reads
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Leituras: registrar" on public.comu_topic_reads
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Leituras: atualizar própria" on public.comu_topic_reads
  for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Seed dos tópicos (idempotente) -------------------------------------
insert into public.comu_topics (slug, name, icon, tone, description, position) values
  ('prints',     'Prints das Operações',   'monitoring',           'primary',   'Compartilhe entradas, saídas e prints dos seus trades.', 1),
  ('tutoriais',  'Tutoriais',              'play_circle',          'tertiary',  'Vídeos e materiais de aprendizado.',                     2),
  ('suporte',    'Suporte',                'support_agent',        'secondary', 'Tire dúvidas com a equipe GVSI.',                        3),
  ('geral',      'Chat Geral',             'forum',                'primary',   'Conversa aberta da comunidade.',                         4),
  ('resultados', 'Resultados / Feedbacks', 'fact_check',           'tertiary',  'Resultados e feedbacks dos membros.',                    5),
  ('recados',    'Recados',                'notifications_active',  'secondary', 'Avisos e atualizações importantes.',                     6),
  ('desafio',    'Desafio',                'emoji_events',         'primary',   'Desafios e competições da comunidade.',                  7),
  ('arquivos',   'Arquivos',               'folder_open',          'tertiary',  'Planilhas, indicadores e downloads.',                    8)
on conflict (slug) do nothing;
