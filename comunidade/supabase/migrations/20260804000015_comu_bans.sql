-- =====================================================================
-- Banimento da comunidade.
--   - comu_banners: allowlist de quem PODE banir (começa só com o henrique).
--   - comu_bans: quem está banido (vê a tela de "demissão" e não posta mais).
--   Banir/desbanir passam por RPC SECURITY DEFINER para que a checagem de
--   "não pode banir admin" enxergue lms_students.role (a RLS de lms_students
--   só deixa o usuário ler o próprio perfil, então em policy isso falharia).
-- =====================================================================
create table if not exists public.comu_banners (
  user_id    uuid primary key references public.lms_students(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.comu_bans (
  user_id    uuid primary key references public.lms_students(id) on delete cascade,
  banned_by  uuid references public.lms_students(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.comu_banners enable row level security;
alter table public.comu_bans    enable row level security;

-- helper: o usuário atual pode banir?
create or replace function public.comu_can_ban()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.comu_banners b where b.user_id = (select auth.uid()));
$$;
grant execute on function public.comu_can_ban() to authenticated;

-- comu_banners: cada um vê só o próprio direito; admin gerencia a lista
drop policy if exists "banners: ver proprio" on public.comu_banners;
create policy "banners: ver proprio" on public.comu_banners for select to authenticated
  using (user_id = (select auth.uid()) or lms_is_admin());
drop policy if exists "banners: admin gerencia" on public.comu_banners;
create policy "banners: admin gerencia" on public.comu_banners for all to authenticated
  using (lms_is_admin()) with check (lms_is_admin());

-- comu_bans: a pessoa vê se ELA está banida; quem pode banir / admin vê tudo.
-- inserir/remover é só via RPC (definer), então não há policy de insert/delete.
drop policy if exists "bans: ver" on public.comu_bans;
create policy "bans: ver" on public.comu_bans for select to authenticated
  using (user_id = (select auth.uid()) or comu_can_ban() or lms_is_admin());

-- banir: só quem está na allowlist; nunca a si mesmo nem um admin
create or replace function public.comu_ban(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.comu_banners b where b.user_id = uid) then
    raise exception 'sem permissao para banir';
  end if;
  if p_user_id = uid then raise exception 'nao pode banir a si mesmo'; end if;
  if exists (select 1 from public.lms_students s where s.id = p_user_id and s.role = 'admin') then
    raise exception 'nao pode banir um administrador';
  end if;
  insert into public.comu_bans (user_id, banned_by) values (p_user_id, uid)
    on conflict (user_id) do nothing;
end $$;
grant execute on function public.comu_ban(uuid) to authenticated;

-- desbanir: quem pode banir ou admin
create or replace function public.comu_unban(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if not (exists (select 1 from public.comu_banners b where b.user_id = uid) or lms_is_admin()) then
    raise exception 'sem permissao';
  end if;
  delete from public.comu_bans where user_id = p_user_id;
end $$;
grant execute on function public.comu_unban(uuid) to authenticated;

-- defesa extra: banido não consegue postar (policy RESTRICTIVE -> combina com AND)
drop policy if exists "msgs: bloqueia banido" on public.comu_messages;
create policy "msgs: bloqueia banido" on public.comu_messages as restrictive for insert to authenticated
  with check (not exists (select 1 from public.comu_bans b where b.user_id = (select auth.uid())));

-- realtime: a pessoa é "demitida" na hora (INSERT em comu_bans -> tela na cara)
alter table public.comu_bans replica identity full;
do $$ begin
  if not exists (select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='comu_bans') then
    alter publication supabase_realtime add table public.comu_bans;
  end if;
end $$;

-- seed: henrique@niinja.com.br pode banir
insert into public.comu_banners (user_id) values ('db32d5d1-8116-44c8-bb11-7aba573f8c34')
  on conflict (user_id) do nothing;
