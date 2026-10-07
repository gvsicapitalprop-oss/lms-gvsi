-- Busca de aulas: o trecho entregue é sempre FALADO (20261007000034, 06/10/2026)
--
-- Na simulação das 4 perguntas do dono, o que mais combinava com "pullback" e "barra forte" era o
-- cabeçalho da aula (curso, módulo e título). A busca devolvia esse cabeçalho como trecho, e a IA
-- e o Jev ficavam sem a explicação do Giovanni: a resposta saía de cabeça e a conferência recusava.
-- Agora a aula continua sendo escolhida pelo melhor trecho (cabeçalho incluído, com o bônus do
-- nome), mas o trecho devolvido e o minuto do link vêm do melhor trecho da transcrição.

set local search_path = public, extensions;

create or replace function public.lms_buscar_aulas(
  p_embedding vector(1536), p_aluno uuid, p_limite integer default 5, p_texto text default null)
returns table (
  lesson_id uuid, curso text, curso_slug text, modulo text, aula text, aula_slug text,
  inicio_s integer, trecho text, similaridade double precision, situacao text, libera_em date,
  bonus double precision
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with pergunta as (
    select translate(lower(coalesce(p_texto, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc') as t
  ), candidatos as (
    select t.lesson_id, t.inicio_s, t.texto, t.cabecalho,
           1 - (t.embedding <=> p_embedding) as sim,
           -- trecho falado primeiro; o cabeçalho só vale se a aula não tiver transcrição
           row_number() over (partition by t.lesson_id order by t.cabecalho::int, t.embedding <=> p_embedding) as ordem_falado
      from public.lms_aula_trechos t
     where t.embedding is not null
  ), por_aula as (
    select c.lesson_id, max(c.sim) as sim,
           max(c.inicio_s) filter (where c.ordem_falado = 1) as inicio_s,
           max(c.texto) filter (where c.ordem_falado = 1) as texto,
           bool_or(c.cabecalho and c.ordem_falado = 1) as so_cabecalho
      from candidatos c
     group by c.lesson_id
  ), pontuadas as (
    select a.*, l.title,
           least(2, (select count(*) from unnest(public.lms_palavras_do_titulo(l.title)) w, pergunta p
                      where p.t <> '' and position(w in p.t) > 0)) * 0.12 as b_titulo
      from por_aula a
      join public.lms_lessons l on l.id = a.lesson_id and l.status = 'published'
      join public.lms_courses cu on cu.id = l.course_id and cu.status = 'published'
      left join public.lms_modules m on m.id = l.module_id
     where m.id is null or m.status = 'published'
  ), com_situacao as (
    select p.*, s.situacao, s.libera_em,
           p.b_titulo + case when s.situacao = 'liberada' then 0.05 else 0 end as b_total
      from pontuadas p
      cross join lateral public.lms_aula_situacao(p_aluno, p.lesson_id) s
  )
  select b.lesson_id, cu.title, cu.slug, m.title, l.title, l.slug,
         case when b.so_cabecalho then 0 else b.inicio_s end, b.texto, b.sim,
         b.situacao, b.libera_em, b.b_total
    from com_situacao b
    join public.lms_lessons l on l.id = b.lesson_id
    join public.lms_courses cu on cu.id = l.course_id
    left join public.lms_modules m on m.id = l.module_id
   order by b.sim + b.b_total desc
   limit greatest(1, least(coalesce(p_limite, 5), 10));
$$;

revoke all on function public.lms_buscar_aulas(vector, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.lms_buscar_aulas(vector, uuid, integer, text) to service_role;
