-- Quem pagou a mesa no Hub e ainda não tem conta na mesa (21/10/2026).
-- A conta da mesa é criada à mão pela equipe, e nada avisava quando alguém comprava: a
-- compra ficava no Hub e a mesa nunca sabia. A hub-mesa-pendentes confere de hora em hora
-- e grava aqui; o painel do suporte mostra a lista para a equipe (só admin).
create table if not exists public.comu_mesa_pendentes (
  email text primary key,
  nome text,
  produto text,
  pago_em timestamptz,
  ref_hub text,
  -- sem_login: precisa convidar na mesa antes de criar a conta; sem_conta: já tem login;
  -- compra_na_fila: já está na fila de provisionamento da mesa
  situacao text not null,
  primeiro_visto_em timestamptz not null default now(),
  visto_em timestamptz not null default now(),
  -- saiu da conferência (ganhou conta ou deixou de ter direito)
  resolvido_em timestamptz,
  -- anotação da equipe (ex.: "vai começar em novembro", "conta com outro e-mail")
  observacao text,
  observacao_por uuid,
  observacao_em timestamptz
);
alter table public.comu_mesa_pendentes enable row level security;
drop policy if exists "Mesa pendentes: admin ve" on public.comu_mesa_pendentes;
create policy "Mesa pendentes: admin ve" on public.comu_mesa_pendentes for select using (lms_is_admin());
drop policy if exists "Mesa pendentes: admin anota" on public.comu_mesa_pendentes;
create policy "Mesa pendentes: admin anota" on public.comu_mesa_pendentes for update using (lms_is_admin()) with check (lms_is_admin());
revoke all on public.comu_mesa_pendentes from anon;
-- a equipe só anota; o resto é da conferência (service_role)
revoke insert, update, delete on public.comu_mesa_pendentes from authenticated;
grant select on public.comu_mesa_pendentes to authenticated;
grant update (observacao, observacao_por, observacao_em) on public.comu_mesa_pendentes to authenticated;

select cron.unschedule('hub-mesa-pendentes') where exists (select 1 from cron.job where jobname = 'hub-mesa-pendentes');
select cron.schedule('hub-mesa-pendentes', '17 * * * *', $c$
  select net.http_post(timeout_milliseconds := 120000,
    url := 'https://mwnyuursbrlfxfssvkyu.supabase.co/functions/v1/hub-mesa-pendentes',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-mod-secret','29cd994b17c3a8c1f6800341e0c1f25ddad047cc345d83a3'));
$c$);
