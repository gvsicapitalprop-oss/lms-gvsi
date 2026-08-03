-- =====================================================================
-- Permissão de postagem por tópico
--   open     : qualquer autenticado escreve (e lê)
--   readonly : só admin publica; todos leem
--   support  : especial (privado por usuário + tickets — ver migration seguinte)
-- =====================================================================

alter table public.comu_topics
  add column if not exists post_policy text not null default 'open'
  check (post_policy in ('open','readonly','support'));

update public.comu_topics set post_policy = 'readonly' where slug in ('tutoriais','recados','desafio','arquivos');
update public.comu_topics set post_policy = 'support'  where slug = 'suporte';
update public.comu_topics set post_policy = 'open'      where slug in ('prints','geral','resultados');

-- INSERT: em tópicos read-only, só admin publica
drop policy if exists "Mensagens: criar" on public.comu_messages;
create policy "Mensagens: criar" on public.comu_messages
  for insert to authenticated
  with check (
    (select auth.uid()) = author_id
    and (
      not exists (
        select 1 from public.comu_topics t
        where t.id = topic_id and t.post_policy = 'readonly'
      )
      or lms_is_admin()
    )
  );
