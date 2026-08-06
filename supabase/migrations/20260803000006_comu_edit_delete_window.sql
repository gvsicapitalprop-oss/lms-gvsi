-- =====================================================================
-- Editar/apagar a PRÓPRIA mensagem só em até 30 min (depois fica permanente).
-- Admin sempre pode (moderação). Apagar = soft delete (status='deleted').
-- Recria TODAS as policies de comu_messages (limpa nomes com mojibake do 0001).
-- =====================================================================

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'comu_messages' loop
    execute format('drop policy if exists %I on public.comu_messages', p.policyname);
  end loop;
end $$;

-- Leitura: privacidade em suporte; mostra "apagadas" como tombstone (body já vem nulo)
create policy "Mensagens: leitura" on public.comu_messages for select to authenticated
  using (
    lms_is_admin()
    or not exists (select 1 from public.comu_topics t where t.id = topic_id and t.post_policy = 'support')
    or exists (select 1 from public.comu_support_tickets k where k.id = ticket_id and k.user_id = (select auth.uid()))
  );

-- Criar: readonly só admin; suporte só admin ou dono do ticket
create policy "Mensagens: criar" on public.comu_messages for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      not exists (select 1 from public.comu_topics t where t.id = topic_id and t.post_policy = 'readonly')
      or lms_is_admin()
    )
    and (
      not exists (select 1 from public.comu_topics t where t.id = topic_id and t.post_policy = 'support')
      or lms_is_admin()
      or exists (select 1 from public.comu_support_tickets k where k.id = ticket_id and k.user_id = (select auth.uid()))
    )
  );

-- Editar a própria só em até 30 min (admin sempre)
create policy "Mensagens: editar" on public.comu_messages for update to authenticated
  using (
    ((select auth.uid()) = author_id and created_at > now() - interval '30 minutes')
    or lms_is_admin()
  )
  with check ((select auth.uid()) = author_id or lms_is_admin());

-- Apagar a própria (hard delete) só em até 30 min (admin sempre)
create policy "Mensagens: apagar" on public.comu_messages for delete to authenticated
  using (
    ((select auth.uid()) = author_id and created_at > now() - interval '30 minutes')
    or lms_is_admin()
  );
