-- =====================================================================
-- (a) Suporte a mensagens de VÍDEO (novo kind)
-- (b) Broadcast também no DELETE, para apagar (hard delete) sumir ao vivo
-- =====================================================================

-- (a) permitir kind='video'
alter table public.comu_messages drop constraint if exists comu_messages_kind_check;
alter table public.comu_messages
  add constraint comu_messages_kind_check
  check (kind in ('text','image','audio','video','file','system'));

-- (b) broadcast de grupo agora cobre DELETE (mensagem sai na hora p/ todos).
--     Reescrito com branch por TG_OP (evita acessar NEW nulo no DELETE).
create or replace function public.comu_broadcast_message()
returns trigger
security definer set search_path = ''
language plpgsql as $$
declare
  v_ticket uuid;
  v_topic  uuid;
begin
  if tg_op = 'DELETE' then
    v_ticket := old.ticket_id; v_topic := old.topic_id;
  else
    v_ticket := new.ticket_id; v_topic := new.topic_id;
  end if;
  if v_ticket is null and v_topic is not null then
    perform realtime.broadcast_changes(
      'topic:' || v_topic::text,
      tg_op, tg_op, tg_table_name, tg_table_schema, new, old
    );
  end if;
  return null;
end;
$$;

drop trigger if exists comu_messages_broadcast on public.comu_messages;
create trigger comu_messages_broadcast
  after insert or update or delete on public.comu_messages
  for each row execute function public.comu_broadcast_message();
