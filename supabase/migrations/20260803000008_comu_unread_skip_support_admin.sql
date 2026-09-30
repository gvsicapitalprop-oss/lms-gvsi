-- =====================================================================
-- Não-lidas: não contar o tópico "Suporte" para administradores.
--   O admin atende pelo console de tickets (rota #/suporte), que NÃO
--   marca o tópico como lido (não passa pela view de chat). Resultado:
--   o badge de não-lidas do Suporte contava todas as mensagens de todos
--   os tickets e nunca zerava — "aparece 1 sem ter nada".
--   Para membros, o tópico Suporte é a própria conversa de atendimento
--   (a RLS já limita às mensagens dos tickets dele) e some ao abrir a
--   conversa, então para eles o badge continua valendo.
-- =====================================================================
create or replace function public.comu_unread_counts()
returns table(topic_id uuid, slug text, unread bigint)
language sql stable security invoker as $$
  select t.id, t.slug,
    count(m.id) filter (
      where m.author_id <> (select auth.uid())
        and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
        and not (t.post_policy = 'support' and lms_is_admin())
    ) as unread
  from public.comu_topics t
  left join public.comu_topic_reads r on r.topic_id = t.id and r.user_id = (select auth.uid())
  left join public.comu_messages m on m.topic_id = t.id and m.status <> 'deleted'
  where t.is_active
  group by t.id, t.slug, r.last_read_at
$$;

grant execute on function public.comu_unread_counts() to authenticated;
