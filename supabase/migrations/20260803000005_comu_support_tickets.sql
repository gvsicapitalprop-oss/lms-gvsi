-- =====================================================================
-- Suporte com tickets + protocolo (staff = admin)
--   - cada membro só vê as PRÓPRIAS mensagens de suporte
--   - admin vê todas as conversas
--   - nova conversa (após a anterior fechada) abre ticket novo + protocolo
-- =====================================================================

create sequence if not exists public.comu_protocol_seq;

create table if not exists public.comu_support_tickets (
  id              uuid primary key default gen_random_uuid(),
  protocol        text unique not null,
  user_id         uuid not null references public.lms_students(id) on delete cascade,
  status          text not null default 'aberto' check (status in ('aberto','resolvido','fechado')),
  subject         text,
  assigned_to     uuid references public.lms_students(id) on delete set null,
  last_message_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  resolved_at     timestamptz
);
create index if not exists comu_support_tickets_user_idx   on public.comu_support_tickets(user_id);
create index if not exists comu_support_tickets_status_idx on public.comu_support_tickets(status, last_message_at desc);

alter table public.comu_messages
  add column if not exists ticket_id uuid references public.comu_support_tickets(id) on delete cascade;
create index if not exists comu_messages_ticket_idx on public.comu_messages(ticket_id);

-- RLS dos tickets
alter table public.comu_support_tickets enable row level security;
drop policy if exists "Tickets: ver" on public.comu_support_tickets;
create policy "Tickets: ver" on public.comu_support_tickets for select to authenticated
  using (user_id = (select auth.uid()) or lms_is_admin());
drop policy if exists "Tickets: criar propria" on public.comu_support_tickets;
create policy "Tickets: criar propria" on public.comu_support_tickets for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "Tickets: admin gerencia" on public.comu_support_tickets;
create policy "Tickets: admin gerencia" on public.comu_support_tickets for update to authenticated
  using (lms_is_admin()) with check (lms_is_admin());

-- comu_messages: leitura privada em tópicos de suporte
drop policy if exists "Mensagens: leitura" on public.comu_messages;
create policy "Mensagens: leitura" on public.comu_messages for select to authenticated
  using (
    (status <> 'deleted' or (select auth.uid()) = author_id or lms_is_admin())
    and (
      lms_is_admin()
      or not exists (select 1 from public.comu_topics t where t.id = topic_id and t.post_policy = 'support')
      or exists (select 1 from public.comu_support_tickets k where k.id = ticket_id and k.user_id = (select auth.uid()))
    )
  );

-- comu_messages: criar (readonly só admin; suporte só admin ou dono do ticket)
drop policy if exists "Mensagens: criar" on public.comu_messages;
create policy "Mensagens: criar" on public.comu_messages for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      not exists (select 1 from public.comu_topics t where t.id = topic_id and t.post_policy = 'readonly')
      or lms_is_admin()
    )
    and (
      not exists (select 1 from public.comu_topics t where t.id = topic_id and t.post_policy = 'support')
      or lms_is_admin()
      or exists (select 1 from public.comu_support_tickets k where k.id = ticket_id and k.user_id = (select auth.uid()))
    )
  );

-- Bump last_message_at ao entrar mensagem num ticket
create or replace function public.comu_touch_ticket()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.ticket_id is not null then
    update public.comu_support_tickets set last_message_at = now(), updated_at = now() where id = new.ticket_id;
  end if;
  return new;
end $$;
drop trigger if exists comu_messages_touch_ticket on public.comu_messages;
create trigger comu_messages_touch_ticket after insert on public.comu_messages
  for each row execute function public.comu_touch_ticket();

-- Membro envia mensagem de suporte: pega ticket aberto ou abre novo (com protocolo)
create or replace function public.comu_send_support_message(
  p_body text, p_kind text default 'text', p_media_url text default null, p_author_name text default null)
returns public.comu_messages
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  v_topic uuid;
  tk public.comu_support_tickets;
  msg public.comu_messages;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into v_topic from public.comu_topics where slug = 'suporte';
  select * into tk from public.comu_support_tickets
    where user_id = uid and status = 'aberto' order by created_at desc limit 1;
  if not found then
    insert into public.comu_support_tickets (protocol, user_id, status, subject)
      values ('SUP-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.comu_protocol_seq')::text,6,'0'),
              uid, 'aberto', left(coalesce(p_body,''), 80))
      returning * into tk;
  end if;
  insert into public.comu_messages (topic_id, author_id, ticket_id, kind, body, media_url, author_name)
    values (v_topic, uid, tk.id, coalesce(p_kind,'text'), p_body, p_media_url, p_author_name)
    returning * into msg;
  return msg;
end $$;
grant execute on function public.comu_send_support_message(text,text,text,text) to authenticated;

-- Realtime p/ tickets
alter table public.comu_support_tickets replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='comu_support_tickets') then
    alter publication supabase_realtime add table public.comu_support_tickets;
  end if;
end $$;
