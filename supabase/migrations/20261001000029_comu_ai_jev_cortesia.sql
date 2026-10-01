-- Triagem com o Jev (TypeSafe) + resposta automática de cortesia no suporte.
-- Nada liga sozinho: auto_cortesia_enabled nasce false (modo sombra).

-- 1) registro da triagem em cada rascunho (modo sombra grava aqui e não envia nada)
alter table public.comu_ai_drafts
  add column if not exists jev jsonb,
  add column if not exists auto_enviado boolean not null default false;

-- 2) chaves de controle, junto das outras do agente
alter table public.comu_ai_support_config
  add column if not exists jev_enabled boolean not null default true,
  add column if not exists auto_cortesia_enabled boolean not null default false,
  add column if not exists auto_cortesia_limite numeric not null default 0.80,
  add column if not exists auto_max_por_ticket integer not null default 2;

comment on column public.comu_ai_support_config.jev_enabled is 'Classifica cada mensagem com o Jev e guarda o veredito no rascunho (modo sombra).';
comment on column public.comu_ai_support_config.auto_cortesia_enabled is 'Deixa o Bruno responder sozinho as mensagens de cortesia. Desligar aqui para parar na hora.';
comment on column public.comu_ai_support_config.auto_cortesia_limite is 'Probabilidade minima de cortesia (Jev) para enviar sozinho.';
comment on column public.comu_ai_support_config.auto_max_por_ticket is 'Teto de respostas automaticas por atendimento.';

-- 3) envio automático: publica o rascunho como mensagem do Bruno, sem exigir admin logado.
--    É o mesmo caminho do comu_ai_draft_approve, menos o Cofre: cortesia não vira conhecimento.
--    Só o service_role chama (as edge functions); ninguém no navegador.
create or replace function public.comu_ai_draft_auto_enviar(p_draft_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare d comu_ai_drafts; v_bot uuid; v_topic uuid; v_name text; v_avatar text; v_msg uuid; v_body text; v_on boolean;
begin
  select auto_cortesia_enabled into v_on from comu_ai_support_config limit 1;
  if not coalesce(v_on, false) then raise exception 'auto desligado'; end if;

  select * into d from comu_ai_drafts where id = p_draft_id;
  if d.id is null then raise exception 'draft not found'; end if;
  if d.status <> 'pending' then raise exception 'draft already %', d.status; end if;

  v_body := btrim(coalesce(d.draft_body, ''));
  if v_body = '' then raise exception 'draft vazio'; end if;

  select bot_user_id into v_bot from comu_ai_support_config limit 1;
  select id into v_topic from comu_topics where post_policy = 'support' order by created_at limit 1;
  select coalesce(full_name, 'Saymon'), avatar_url into v_name, v_avatar
    from lms_students where id = 'e56f879d-2789-4da0-9998-130f9a3bab41';

  insert into comu_messages(topic_id, author_id, kind, body, status, ticket_id, author_name, author_avatar, media_meta)
  values (v_topic, v_bot, 'text', v_body, 'sent', d.ticket_id, coalesce(v_name, 'Saymon'), v_avatar,
          jsonb_build_object('auto', 'cortesia', 'draft_id', d.id))
  returning id into v_msg;

  update comu_ai_drafts
     set status = 'approved', auto_enviado = true, reviewed_at = now(), sent_message_id = v_msg
   where id = d.id;

  return v_msg;
end
$function$;

revoke all on function public.comu_ai_draft_auto_enviar(uuid) from public, anon, authenticated;
grant execute on function public.comu_ai_draft_auto_enviar(uuid) to service_role;

-- 4) quantas respostas automáticas já saíram num atendimento (o teto por ticket)
create or replace function public.comu_ai_auto_no_ticket(p_ticket uuid)
returns integer
language sql
stable
security definer
set search_path to 'public'
as $function$
  select count(*)::int from comu_messages
   where ticket_id = p_ticket and media_meta ->> 'auto' = 'cortesia';
$function$;

revoke all on function public.comu_ai_auto_no_ticket(uuid) from public, anon, authenticated;
grant execute on function public.comu_ai_auto_no_ticket(uuid) to service_role;
