-- "So passando para saber..." so depois de uma resposta da equipe que AINDA EXISTE (14/10/2026).
--
-- last_agent_at e marcado pelo gatilho comu_support_followup_track quando alguem da equipe
-- (admin/suporte) manda mensagem. Apagar a mensagem no console (delete de verdade) nao desfazia
-- a marca: no SUP-2026-002156 a equipe mandou e apagou uma mensagem as 08:37/08:50, e as 09:38 o
-- aluno, que pedia reembolso e ninguem tinha respondido, recebeu o "so passando" (4 de 452 casos
-- em 14 dias). Agora, antes de perguntar ou encerrar, confere se existe mensagem da equipe depois
-- da ultima mensagem do aluno; se nao existe, a marca e desfeita e nada e enviado.

create or replace function public.comu_support_autoflow()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare v_topic uuid; v_bot uuid; t record;
begin
  select id into v_topic from public.comu_topics where slug='suporte';
  select bot_user_id into v_bot from public.comu_ai_support_config limit 1;
  if v_bot is null then select id into v_bot from auth.users where email='bruno-ia@gvsi.app' limit 1; end if;

  -- a resposta da equipe que marcou o ticket foi apagada: desfaz a marca antes de qualquer envio
  update public.comu_support_tickets k
     set last_agent_at = null, followup_msg_at = null, auto_close_at = null
   where k.status = 'aberto' and k.last_agent_at is not null
     and not exists (
       select 1 from public.comu_messages a
         join public.lms_students s on s.id = a.author_id
        where a.ticket_id = k.id
          and a.kind <> 'system'
          and coalesce(a.status, 'sent') <> 'deleted'
          and s.role in ('admin', 'suporte')
          and a.created_at > coalesce((select max(c.created_at) from public.comu_messages c
                                        where c.ticket_id = k.id and c.author_id = k.user_id), '-infinity'::timestamptz));

  -- 1h após a resposta do suporte, sem retorno do membro: pergunta se precisa de algo
  for t in select id from public.comu_support_tickets
           where status='aberto' and last_agent_at is not null and followup_msg_at is null
             and last_agent_at < now() - interval '1 hour' loop
    insert into public.comu_messages (topic_id,author_id,ticket_id,kind,body,author_name,author_avatar)
      values (v_topic, v_bot, t.id, 'text',
        'Oi! Só passando para saber se você ainda precisa de ajuda com algo. Se não tiver retorno, encerro este atendimento em 2 horas. 🙂',
        'Suporte', (select avatar_url from public.lms_students where id=v_bot));
    update public.comu_support_tickets set followup_msg_at = now() where id = t.id;
  end loop;

  -- 2h após a pergunta, ainda sem retorno do membro: encerra automaticamente
  for t in select id from public.comu_support_tickets
           where status='aberto' and followup_msg_at is not null and last_agent_at is not null
             and followup_msg_at < now() - interval '2 hours' loop
    update public.comu_support_tickets set status='resolvido', resolved_at=now(), last_agent_at=null, followup_msg_at=null, auto_close_at=null where id = t.id;
    insert into public.comu_messages (topic_id,author_id,ticket_id,kind,body,author_name)
      values (v_topic, v_bot, t.id, 'system',
        'Atendimento encerrado automaticamente por inatividade. Se precisar, é só enviar uma nova mensagem. 🙏', 'Suporte');
  end loop;
end $function$;
