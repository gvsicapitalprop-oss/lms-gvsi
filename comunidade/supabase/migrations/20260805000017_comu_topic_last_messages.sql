-- =====================================================================
-- Menu lateral dinâmico: última mensagem de cada tópico (estilo WhatsApp).
--   SECURITY INVOKER de propósito -> respeita a RLS de comu_messages, então
--   o Suporte mostra só a última mensagem que o PRÓPRIO usuário pode ver
--   (privacidade dos tickets preservada). Ignora mensagens apagadas.
-- =====================================================================
create or replace function public.comu_topic_last_messages()
returns table (slug text, body text, kind text, author_name text, created_at timestamptz)
language sql stable security invoker set search_path = public as $$
  select distinct on (t.id) t.slug, m.body, m.kind, m.author_name, m.created_at
  from public.comu_topics t
  join public.comu_messages m on m.topic_id = t.id
  where t.is_active = true and m.status <> 'deleted'
  order by t.id, m.created_at desc;
$$;
grant execute on function public.comu_topic_last_messages() to authenticated;
