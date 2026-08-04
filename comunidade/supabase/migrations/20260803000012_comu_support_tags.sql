-- =====================================================================
-- Tags de suporte: o admin cria tags e aplica em contatos (membros) para
-- identificá-los no console. Tudo admin-only.
-- =====================================================================
create table if not exists public.comu_support_tags (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null default '#2563eb',
  created_at timestamptz not null default now()
);

create table if not exists public.comu_support_contact_tags (
  user_id    uuid not null references public.lms_students(id) on delete cascade,
  tag_id     uuid not null references public.comu_support_tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, tag_id)
);

alter table public.comu_support_tags enable row level security;
alter table public.comu_support_contact_tags enable row level security;

drop policy if exists "comu tags: admin gerencia" on public.comu_support_tags;
create policy "comu tags: admin gerencia" on public.comu_support_tags
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());

drop policy if exists "comu contact_tags: admin gerencia" on public.comu_support_contact_tags;
create policy "comu contact_tags: admin gerencia" on public.comu_support_contact_tags
  for all to authenticated using (lms_is_admin()) with check (lms_is_admin());
