-- =====================================================================
-- Reações via Broadcast: inclui user_name no payload (pra "ver quem reagiu"
-- funcionar ao vivo sem lookup). Canal = topic:<topic_id> (o mesmo das
-- mensagens), evento 'reaction', payload {op, message_id, user_id, reaction,
-- user_name}. Só grupos (tickets de suporte não fazem fan-out de reação).
-- =====================================================================
create or replace function public.comu_broadcast_reaction()
returns trigger language plpgsql security definer set search_path to '' as $function$
declare
  v_topic  uuid;
  v_ticket uuid;
  v_msg    uuid := coalesce(new.message_id, old.message_id);
begin
  select m.topic_id, m.ticket_id into v_topic, v_ticket
  from public.comu_messages m where m.id = v_msg;
  if v_ticket is null and v_topic is not null then
    perform realtime.send(
      jsonb_build_object(
        'op',         tg_op,
        'message_id', v_msg,
        'user_id',    coalesce(new.user_id, old.user_id),
        'reaction',   coalesce(new.reaction, old.reaction),
        'user_name',  coalesce(new.user_name, old.user_name)
      ),
      'reaction',
      'topic:' || v_topic::text,
      true
    );
  end if;
  return null;
end;
$function$;
