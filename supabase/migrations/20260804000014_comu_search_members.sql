-- =====================================================================
-- #6 Menções (@pessoas): busca de membros para o autocomplete.
--   Membros só conseguem ler o próprio perfil em lms_students (RLS), então
--   o autocomplete precisa de uma função SECURITY DEFINER que devolve só
--   id/nome/avatar de poucos membros por vez. Nomes já aparecem nas
--   mensagens (author_name), então isso não expõe nada novo.
-- =====================================================================
create or replace function public.comu_search_members(p_q text default '')
returns table (id uuid, full_name text, avatar_url text)
language sql stable security definer set search_path = public as $$
  select s.id, s.full_name, s.avatar_url
  from public.lms_students s
  where coalesce(s.full_name, '') <> ''
    and s.id is distinct from (select auth.uid())
    and (coalesce(p_q, '') = '' or s.full_name ilike '%' || p_q || '%')
  order by s.full_name
  limit 8;
$$;
grant execute on function public.comu_search_members(text) to authenticated;
