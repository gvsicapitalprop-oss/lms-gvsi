-- =====================================================================
-- Orquestrador de IA (Bruno) no Suporte da comunidade.
--   - Estado por ticket: ai_active (IA responde?), ai_attempts (tentativas),
--     needs_human (marcado p/ humano assumir — handoff silencioso).
--   - comu_ai_support_config: singleton com KILL SWITCH (começa DESLIGADO),
--     persona, teto de tentativas, mensagem de "aguenta aí" no handoff, e o
--     bot_user_id (o "Bruno" que assina as mensagens da IA).
--   O worker roda na VPS com service_role (bypassa RLS); RLS aqui é só pra UI.
-- =====================================================================
alter table public.comu_support_tickets
  add column if not exists ai_active   boolean not null default true,
  add column if not exists ai_attempts int     not null default 0,
  add column if not exists needs_human boolean not null default false;

create table if not exists public.comu_ai_support_config (
  id           int primary key default 1,
  enabled      boolean not null default false,   -- KILL SWITCH: começa DESLIGADO
  persona      text    not null default 'barbara',
  max_attempts int     not null default 4,
  hold_message text,
  bot_user_id  uuid,
  updated_at   timestamptz not null default now(),
  constraint comu_ai_support_config_singleton check (id = 1)
);
insert into public.comu_ai_support_config (id, hold_message)
  values (1, 'Deixa eu verificar isso com calma pra você, só um instante 🙏')
  on conflict (id) do nothing;

alter table public.comu_ai_support_config enable row level security;
drop policy if exists "comu_ai_cfg admin" on public.comu_ai_support_config;
create policy "comu_ai_cfg admin" on public.comu_ai_support_config
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());
