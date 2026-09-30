-- =====================================================================
-- Tier "dono" (owner) acima de admin — governança.
--   Motivo: um admin é gente contratada da comunidade; se agir mal, o dono
--   precisa poder remover/banir esse admin. Então:
--     - dono: bane admins E membros; NUNCA é banido (nem por outro dono).
--     - quem está em comu_banners (mas não é dono): bane só membros comuns.
--     - admin comum: continua sem poder banir (não está em comu_banners).
--   comu_owners é gerido só por SQL (seed), não pela app.
-- =====================================================================
create table if not exists public.comu_owners (
  user_id    uuid primary key references public.lms_students(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.comu_owners enable row level security;
drop policy if exists "owners: ver" on public.comu_owners;
create policy "owners: ver" on public.comu_owners for select to authenticated
  using (user_id = (select auth.uid()) or lms_is_admin());

-- pode banir? dono OU quem está na allowlist
create or replace function public.comu_can_ban()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.comu_banners b where b.user_id = (select auth.uid()))
      or exists (select 1 from public.comu_owners  o where o.user_id = (select auth.uid()));
$$;
grant execute on function public.comu_can_ban() to authenticated;

-- banir com hierarquia
create or replace function public.comu_ban(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  caller_owner boolean;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  caller_owner := exists (select 1 from public.comu_owners o where o.user_id = uid);
  if not (caller_owner or exists (select 1 from public.comu_banners b where b.user_id = uid)) then
    raise exception 'sem permissao para banir';
  end if;
  if p_user_id = uid then raise exception 'nao pode banir a si mesmo'; end if;
  -- dono é intocável (nem outro dono bane)
  if exists (select 1 from public.comu_owners o where o.user_id = p_user_id) then
    raise exception 'nao pode banir o dono';
  end if;
  -- admin só cai pela mão do dono
  if exists (select 1 from public.lms_students s where s.id = p_user_id and s.role = 'admin')
     and not caller_owner then
    raise exception 'so o dono pode banir um administrador';
  end if;
  insert into public.comu_bans (user_id, banned_by) values (p_user_id, uid)
    on conflict (user_id) do nothing;
end $$;
grant execute on function public.comu_ban(uuid) to authenticated;

-- desbanir: dono, allowlist ou admin
create or replace function public.comu_unban(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if not (exists (select 1 from public.comu_owners  o where o.user_id = uid)
          or exists (select 1 from public.comu_banners b where b.user_id = uid)
          or lms_is_admin()) then
    raise exception 'sem permissao';
  end if;
  delete from public.comu_bans where user_id = p_user_id;
end $$;
grant execute on function public.comu_unban(uuid) to authenticated;

-- henrique@niinja.com.br = DONO: admin (poderes de moderação) + owner + banner
update public.lms_students set role = 'admin'
  where id = 'db32d5d1-8116-44c8-bb11-7aba573f8c34';
insert into public.comu_owners  (user_id) values ('db32d5d1-8116-44c8-bb11-7aba573f8c34') on conflict do nothing;
insert into public.comu_banners (user_id) values ('db32d5d1-8116-44c8-bb11-7aba573f8c34') on conflict do nothing;
