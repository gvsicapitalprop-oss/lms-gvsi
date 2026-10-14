-- Sala ao Vivo: pedir pela Comunidade e pelo chat do suporte (pedido do dono em 14/10/2026).
--
-- Desde 08/10 a Sala so aparece para quem concluiu o modulo 8 ("ACESSO A SALA AO VIVO") e
-- SOLICITOU. O botao de solicitar ficava so na pagina do curso da area de membros: 337 dos
-- 627 alunos que concluiram o modulo nunca pediram. Agora o pedido tambem sai:
--  - pela lista de topicos da Comunidade (comu_sala_situacao + comu_solicitar_sala);
--  - pelo chat do suporte: a support-draft libera sozinha quando o aluno pede (comu_sala_liberar).
-- A regra e a mesma do botao da area de membros (web/src/app/acoes.ts, solicitarAcessoSala):
-- concluiu uma aula de um dos modulos abaixo -> registra em lms_sala_solicitacoes e libera o
-- topico na hora. A hub-sync continua mantendo so quem tem acesso ativo.

create or replace function public.comu_sala_liberar(p_aluno uuid, p_origem text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_aula uuid;
  v_email text;
begin
  if p_aluno is null then return 'sem_aluno'; end if;
  if exists (select 1 from comu_topic_access
              where topic_id = '7acf1d70-316b-4958-a037-3d39b0eda7c2' and user_id = p_aluno) then
    return 'ja_tinha';
  end if;

  select p.lesson_id into v_aula
    from lms_lesson_progress p
    join lms_lessons l on l.id = p.lesson_id
   where p.student_id = p_aluno
     and p.completed
     and l.status = 'published'
     and l.module_id in ('c96a21e4-9968-53ee-962f-30fba74539ed',  -- ACESSO A SALA AO VIVO (Programa Master Trader)
                         '37df71a3-55d2-5a12-b1a7-73679273e823')  -- ACESSO A SALA AO VIVO (Programa Master Trader 1.0)
   limit 1;
  if v_aula is null then return 'modulo8_incompleto'; end if;

  select email into v_email from lms_students where id = p_aluno;
  insert into lms_sala_solicitacoes (student_id, email, modulo8_lesson_id, origem, concedido_em)
  values (p_aluno, v_email, v_aula, coalesce(p_origem, 'aluno'), now())
  on conflict (student_id) do nothing;
  insert into comu_topic_access (topic_id, user_id)
  values ('7acf1d70-316b-4958-a037-3d39b0eda7c2', p_aluno)
  on conflict do nothing;

  -- mesmo diario da area de membros (Relatorios e auditoria)
  insert into lms_access_logs (event, student_id, details)
  values ('sala_solicitada', p_aluno, jsonb_build_object('origem', p_origem)),
         ('sala_liberada', p_aluno, jsonb_build_object('origem', p_origem));
  return 'liberada';
end
$$;

revoke all on function public.comu_sala_liberar(uuid, text) from public, anon, authenticated;
grant execute on function public.comu_sala_liberar(uuid, text) to service_role;

-- O que a Comunidade mostra em "Exclusivos" para quem ainda nao ve o topico.
create or replace function public.comu_sala_situacao()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tem_sala', exists (select 1 from comu_topic_access
                         where topic_id = '7acf1d70-316b-4958-a037-3d39b0eda7c2' and user_id = auth.uid()),
    'concluiu_modulo8', exists (
      select 1 from lms_lesson_progress p join lms_lessons l on l.id = p.lesson_id
       where p.student_id = auth.uid() and p.completed and l.status = 'published'
         and l.module_id in ('c96a21e4-9968-53ee-962f-30fba74539ed', '37df71a3-55d2-5a12-b1a7-73679273e823')),
    'tem_master', exists (
      select 1 from lms_subscriptions s join lms_courses c on c.id = s.course_id
       where s.student_id = auth.uid() and s.status = 'active'
         and c.slug in ('programa-master-trader', 'programa-master-trader-1-0'))
  );
$$;

revoke all on function public.comu_sala_situacao() from public, anon;
grant execute on function public.comu_sala_situacao() to authenticated;

-- O toque em "Solicitar acesso" na Comunidade: o proprio aluno, nunca outro.
create or replace function public.comu_solicitar_sala()
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return 'sem_aluno'; end if;
  return comu_sala_liberar(auth.uid(), 'comunidade');
end
$$;

revoke all on function public.comu_solicitar_sala() from public, anon;
grant execute on function public.comu_solicitar_sala() to authenticated;

-- O envio automatico da confirmacao (support-draft -> comu_ai_draft_auto_enviar): model
-- 'sala-liberada' vira o tipo 'sala'. Sai sempre que a IA esta ligada, porque o acesso ja
-- foi liberado e o aluno precisa saber; nao depende da chave de cortesia nem de resposta.
do $do$
declare b text;
begin
  select pg_get_functiondef(p.oid) into b from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'comu_ai_draft_auto_enviar' and n.nspname = 'public';
  b := replace(b,
    $$v_tipo := case d.model when 'auto-resposta' then 'resposta' when 'aviso-equipe' then 'aviso_equipe' else 'cortesia' end;$$,
    $$v_tipo := case d.model when 'auto-resposta' then 'resposta' when 'aviso-equipe' then 'aviso_equipe' when 'sala-liberada' then 'sala' else 'cortesia' end;$$);
  b := replace(b,
    $$if v_tipo <> 'cortesia' and not coalesce(v_cfg.auto_resposta_enabled, false) then raise exception 'auto desligado'; end if;$$,
    $$if v_tipo not in ('cortesia', 'sala') and not coalesce(v_cfg.auto_resposta_enabled, false) then raise exception 'auto desligado'; end if;$$);
  if b not like '%''sala-liberada'' then ''sala''%' then raise exception 'anchor tipo nao achado'; end if;
  if b not like '%not in (''cortesia'', ''sala'')%' then raise exception 'anchor trava nao achado'; end if;
  execute b;
end $do$;

-- A cortesia-tick descarta o agendado quando chega mensagem nova no ticket. Para a confirmacao
-- da Sala isso nao vale: o acesso ja foi liberado e o aluno precisa saber, mesmo que tenha
-- mandado outra coisa no meio.
do $do$
declare b text;
begin
  select pg_get_functiondef(p.oid) into b from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'comu_ai_cortesia_tick' and n.nspname = 'public';
  b := replace(b, $$select d.id, d.ticket_id, d.created_at$$, $$select d.id, d.ticket_id, d.created_at, d.model$$);
  b := replace(b, $$    if exists ($$, $$    if r.model is distinct from 'sala-liberada' and exists ($$);
  if b not like '%d.created_at, d.model%' then raise exception 'anchor select nao achado'; end if;
  if b not like '%is distinct from ''sala-liberada''%' then raise exception 'anchor exists nao achado'; end if;
  execute b;
end $do$;
