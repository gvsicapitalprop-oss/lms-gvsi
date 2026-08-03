-- =====================================================================
-- Mídia (Storage), Realtime de reações e contagem de não-lidas
-- =====================================================================

-- 1) Bucket de mídia da comunidade (público — URLs são uuids não-adivinháveis)
insert into storage.buckets (id, name, public)
values ('comu-media', 'comu-media', true)
on conflict (id) do nothing;

drop policy if exists "comu-media upload" on storage.objects;
create policy "comu-media upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comu-media');

drop policy if exists "comu-media leitura" on storage.objects;
create policy "comu-media leitura" on storage.objects
  for select to public
  using (bucket_id = 'comu-media');

drop policy if exists "comu-media dono apaga" on storage.objects;
create policy "comu-media dono apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'comu-media' and owner = (select auth.uid()));

-- 2) Reações: realtime + replica identity full (p/ DELETE trazer a linha inteira)
alter table public.comu_message_reactions replica identity full;
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='comu_message_reactions'
  ) then
    alter publication supabase_realtime add table public.comu_message_reactions;
  end if;
end $$;

-- 3) Não-lidas por tópico para o usuário atual (exclui as próprias mensagens)
create or replace function public.comu_unread_counts()
returns table(topic_id uuid, slug text, unread bigint)
language sql stable security invoker as $$
  select t.id, t.slug,
    count(m.id) filter (
      where m.author_id <> (select auth.uid())
        and m.created_at > coalesce(r.last_read_at, 'epoch'::timestamptz)
    ) as unread
  from public.comu_topics t
  left join public.comu_topic_reads r on r.topic_id = t.id and r.user_id = (select auth.uid())
  left join public.comu_messages m on m.topic_id = t.id and m.status <> 'deleted'
  where t.is_active
  group by t.id, t.slug, r.last_read_at
$$;

grant execute on function public.comu_unread_counts() to authenticated;
