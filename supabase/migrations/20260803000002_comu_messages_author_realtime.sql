-- =====================================================================
-- comu_messages: nome/avatar do autor desnormalizados + Realtime
-- Motivo: a RLS de lms_students só permite ler o PRÓPRIO perfil, então
-- não dá pra exibir o nome dos outros autores via join. Cada mensagem
-- guarda o nome/avatar de quem enviou (o autor grava com o próprio dado).
-- =====================================================================

alter table public.comu_messages
  add column if not exists author_name   text,
  add column if not exists author_avatar text;

-- Realtime: publica comu_messages (idempotente)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'comu_messages'
  ) then
    alter publication supabase_realtime add table public.comu_messages;
  end if;
end $$;
