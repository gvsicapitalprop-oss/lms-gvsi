-- Os trechos falados da aula que mais combinam com a dúvida (20261007000035, 06/10/2026)
--
-- Um trecho só (75 s) não basta: na simulação, o melhor trecho de "Pullback" era a abertura da
-- aula ("vou te passar a melhor maneira de ingressar no pullback") e a explicação vinha depois. A
-- IA respondia de cabeça e a conferência do Jev recusava, com razão. Depois que o Jev escolhe a
-- aula, o support-draft busca aqui os 3 trechos falados mais próximos da dúvida, na ordem da aula.

set local search_path = public, extensions;

create or replace function public.lms_trechos_da_aula(p_embedding vector(1536), p_aula uuid, p_limite integer default 3)
returns table (inicio_s integer, fim_s integer, texto text, similaridade double precision)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  select x.inicio_s, x.fim_s, x.texto, x.sim
    from (
      select t.inicio_s, t.fim_s, t.texto, 1 - (t.embedding <=> p_embedding) as sim
        from public.lms_aula_trechos t
       where t.lesson_id = p_aula and not t.cabecalho and t.embedding is not null
       order by t.embedding <=> p_embedding
       limit greatest(1, least(coalesce(p_limite, 3), 6))
    ) x
   order by x.inicio_s;
$$;

revoke all on function public.lms_trechos_da_aula(vector, uuid, integer) from public, anon, authenticated;
grant execute on function public.lms_trechos_da_aula(vector, uuid, integer) to service_role;
