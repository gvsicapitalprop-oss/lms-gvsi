-- =====================================================================
-- Realtime do chat de GRUPO via BROADCAST (escala p/ centenas simultâneos)
--
-- Motivo: postgres_changes reavalia RLS por assinante numa fila única
-- (efeito "megafone") e não escala para 400+ numa sala. Broadcast publica
-- uma vez e o servidor de Realtime distribui.
--
-- Mensagens/Reações de GRUPO (ticket_id IS NULL) -> canal privado
-- 'topic:<topic_id>'. O SUPORTE (tickets 1:1, ticket_id preenchido) NÃO
-- entra aqui e continua em postgres_changes (lá não há fan-out).
--
-- Envio é feito por realtime.broadcast_changes/realtime.send (privilegiado)
-- dentro de gatilhos SECURITY DEFINER. NÃO criamos policy de INSERT em
-- realtime.messages de propósito: só os gatilhos publicam; clientes não
-- conseguem forjar mensagens no canal (apenas RECEBER, via policy SELECT).
-- =====================================================================

-- 1) Mensagens de grupo -> broadcast em topic:<topic_id> (INSERT e UPDATE)
create or replace function public.comu_broadcast_message()
returns trigger
security definer set search_path = ''
language plpgsql as $$
begin
  if coalesce(new.ticket_id, old.ticket_id) is null then
    perform realtime.broadcast_changes(
      'topic:' || coalesce(new.topic_id, old.topic_id)::text,  -- topic
      tg_op,            -- event: INSERT | UPDATE
      tg_op,            -- operation
      tg_table_name,    -- table
      tg_table_schema,  -- schema
      new,
      old
    );
  end if;
  return null;
end;
$$;

drop trigger if exists comu_messages_broadcast on public.comu_messages;
create trigger comu_messages_broadcast
  after insert or update on public.comu_messages
  for each row execute function public.comu_broadcast_message();

-- 2) Reações de mensagens de grupo -> broadcast em topic:<topic_id>
create or replace function public.comu_broadcast_reaction()
returns trigger
security definer set search_path = ''
language plpgsql as $$
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
        'op',         tg_op,                              -- INSERT | DELETE
        'message_id', v_msg,
        'user_id',    coalesce(new.user_id, old.user_id),
        'reaction',   coalesce(new.reaction, old.reaction)
      ),
      'reaction',                 -- event
      'topic:' || v_topic::text,  -- topic
      true                        -- private
    );
  end if;
  return null;
end;
$$;

drop trigger if exists comu_reactions_broadcast on public.comu_message_reactions;
create trigger comu_reactions_broadcast
  after insert or delete on public.comu_message_reactions
  for each row execute function public.comu_broadcast_reaction();

-- 3) Autorização de RECEBIMENTO (private channel): autenticado pode ler
-- broadcasts de tópicos ativos. Sem policy de INSERT (só gatilhos publicam).
drop policy if exists "comu: receber broadcast de topicos" on realtime.messages;
create policy "comu: receber broadcast de topicos"
on realtime.messages
for select
to authenticated
using (
  realtime.messages.extension = 'broadcast'
  and exists (
    select 1 from public.comu_topics t
    where t.is_active and 'topic:' || t.id::text = realtime.topic()
  )
);
