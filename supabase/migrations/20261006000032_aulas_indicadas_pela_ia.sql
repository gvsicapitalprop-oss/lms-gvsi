-- Aulas indicadas pela IA do suporte (pedido do dono, 06/10/2026)
--
-- "Preciso que a nossa IA consiga indicar aulas que falem sobre X assuntos que a pessoa tem
-- dúvida [...] já busque a aula correta para indicar para aquela pessoa [...] e envie o link."
--
-- Como funciona:
--   1. As transcrições das aulas (lms_settings 'aula_transcricao:<id>', SRT) viram trechos de
--      1 a 2 minutos com o segundo em que começam, mais um trecho de cabeçalho por aula
--      (curso, módulo, título e descrição). Cada trecho ganha o embedding do mesmo modelo da base
--      de conhecimento do suporte (text-embedding-3-small). Quem gera é a função aulas-indexar,
--      de 10 em 10 minutos, só para a aula nova ou com transcrição/aula alterada.
--   2. No rascunho do suporte (support-draft), dúvida de conteúdo busca as aulas mais próximas
--      (lms_buscar_aulas), o Jev escolhe qual responde (ou nenhuma) e o sistema monta o link
--      com o minuto (?t=). A IA nunca escreve o link.
--   3. Decisões do dono: passa pela aprovação como as outras respostas; aula que a pessoa não
--      tem (ou que ainda não liberou) pode ser indicada, avisando de qual curso é ou quando libera.
--   4. Link de aula não vai para a base de conhecimento: a resposta aprovada é aprendida sem a
--      linha do link (o próximo aluno pode não ter acesso àquela aula).
-- Só acrescenta: nenhuma tabela ou função existente muda de comportamento.

set local search_path = public, extensions;


-- ── 1. Os trechos ────────────────────────────────────────────────────────────────────────────────

create table if not exists public.lms_aula_trechos (
  id                  bigint generated always as identity primary key,
  lesson_id           uuid not null references public.lms_lessons(id) on delete cascade,
  inicio_s            integer not null,          -- segundo do vídeo onde o trecho começa
  fim_s               integer not null,
  texto               text not null,
  cabecalho           boolean not null default false,  -- curso, módulo, título e descrição
  embedding           vector(1536),
  fonte_atualizada_em timestamptz,               -- atualizadaEm da transcrição usada
  criado_em           timestamptz not null default now()
);

comment on table public.lms_aula_trechos is
  'Trechos das transcrições das aulas com embedding, para a IA do suporte indicar a aula certa (20261006000032). Escrita só pela função aulas-indexar.';

create index if not exists idx_lms_aula_trechos_aula on public.lms_aula_trechos (lesson_id);

alter table public.lms_aula_trechos enable row level security;
revoke all on public.lms_aula_trechos from anon, authenticated;


-- ── 2. Situação da aula para um aluno (o servidor pergunta por ele) ──────────────────────────────
-- Mesmas regras de lms_tem_acesso_curso / lms_aula_liberada (migracao/rls-acesso.sql), mas com o
-- aluno como parâmetro: essas leem auth.uid(), que é nulo na chamada do servidor.

create or replace function public.lms_drip_libera_em(p_tipo text, p_data date, p_dias integer, p_desde timestamptz)
returns date
language sql
immutable
as $$
  select case
    when coalesce(p_tipo, 'immediate') = 'immediate' then null
    when p_tipo = 'date' then p_data
    when p_tipo = 'days' and p_desde is not null then date_trunc('day', p_desde)::date + coalesce(p_dias, 0)
    else null
  end;
$$;

create or replace function public.lms_aula_situacao(p_aluno uuid, p_aula uuid)
returns table (situacao text, libera_em date)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_curso  uuid;
  v_modulo uuid;
  v_assin  record;
  v_mod    record;
  v_aula   record;
  v_mod_ok boolean := true;
  v_data   date;
begin
  select l.course_id, l.module_id, l.drip_type, l.drip_date, l.drip_days
    into v_aula
    from public.lms_lessons l where l.id = p_aula;
  if v_aula.course_id is null then
    return query select 'sem_acesso'::text, null::date;
    return;
  end if;

  select s.ignore_drip, coalesce(s.starts_at, s.created_at) as inicio
    into v_assin
    from public.lms_subscriptions s
   where s.student_id = p_aluno
     and s.course_id  = v_aula.course_id
     and (s.access_open is true or s.status = 'active')
   order by s.created_at asc
   limit 1;
  if not found then
    return query select 'sem_acesso'::text, null::date;
    return;
  end if;
  if v_assin.ignore_drip is true then
    return query select 'liberada'::text, null::date;
    return;
  end if;

  if v_aula.module_id is not null then
    select m.drip_type, m.drip_date, m.drip_days into v_mod from public.lms_modules m where m.id = v_aula.module_id;
    v_mod_ok := public.lms_drip_liberado(v_mod.drip_type, v_mod.drip_date, v_mod.drip_days, v_assin.inicio);
  end if;

  if v_mod_ok is true and public.lms_drip_liberado(v_aula.drip_type, v_aula.drip_date, v_aula.drip_days, v_assin.inicio) is true then
    return query select 'liberada'::text, null::date;
    return;
  end if;

  -- trancada: libera quando o módulo e a aula liberarem (a data mais tarde das duas)
  v_data := greatest(
    case when v_mod_ok is not true then public.lms_drip_libera_em(v_mod.drip_type, v_mod.drip_date, v_mod.drip_days, v_assin.inicio) end,
    public.lms_drip_libera_em(v_aula.drip_type, v_aula.drip_date, v_aula.drip_days, v_assin.inicio)
  );
  return query select 'bloqueada'::text, v_data;
end;
$$;

revoke all on function public.lms_aula_situacao(uuid, uuid) from public, anon, authenticated;
grant execute on function public.lms_aula_situacao(uuid, uuid) to service_role;


-- ── 3. A busca ───────────────────────────────────────────────────────────────────────────────────
-- As aulas publicadas mais próximas da pergunta, uma linha por aula (o melhor trecho dela), com a
-- situação para o aluno. Quem chama é o support-draft (service_role).

create or replace function public.lms_buscar_aulas(p_embedding vector(1536), p_aluno uuid, p_limite integer default 5)
returns table (
  lesson_id uuid, curso text, curso_slug text, modulo text, aula text, aula_slug text,
  inicio_s integer, trecho text, similaridade double precision, situacao text, libera_em date
)
language sql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
  with candidatos as (
    select t.lesson_id, t.inicio_s, t.texto, t.cabecalho,
           1 - (t.embedding <=> p_embedding) as sim,
           row_number() over (partition by t.lesson_id order by t.embedding <=> p_embedding) as ordem
      from public.lms_aula_trechos t
     where t.embedding is not null
  ), melhores as (
    select c.* from candidatos c
      join public.lms_lessons l on l.id = c.lesson_id and l.status = 'published'
      join public.lms_courses cu on cu.id = l.course_id and cu.status = 'published'
      left join public.lms_modules m on m.id = l.module_id
     where c.ordem = 1 and (m.id is null or m.status = 'published')
     order by c.sim desc
     limit greatest(1, least(coalesce(p_limite, 5), 10))
  )
  select b.lesson_id, cu.title, cu.slug, m.title, l.title, l.slug,
         case when b.cabecalho then 0 else b.inicio_s end, b.texto, b.sim,
         s.situacao, s.libera_em
    from melhores b
    join public.lms_lessons l on l.id = b.lesson_id
    join public.lms_courses cu on cu.id = l.course_id
    left join public.lms_modules m on m.id = l.module_id
    cross join lateral public.lms_aula_situacao(p_aluno, b.lesson_id) s
   order by b.sim desc;
$$;

revoke all on function public.lms_buscar_aulas(vector, uuid, integer) from public, anon, authenticated;
grant execute on function public.lms_buscar_aulas(vector, uuid, integer) to service_role;


-- ── 4. O que falta indexar ───────────────────────────────────────────────────────────────────────
-- Aula publicada com transcrição pronta que ainda não tem trechos, ou cuja transcrição (ou a
-- própria aula: título, descrição, módulo) mudou depois da indexação.

create or replace function public.lms_aulas_para_indexar(p_limite integer default 10)
returns table (lesson_id uuid, transcricao_atualizada_em timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select l.id, nullif(s.value ->> 'atualizadaEm', '')::timestamptz
    from public.lms_lessons l
    join public.lms_settings s on s.key = 'aula_transcricao:' || l.id::text
   where l.status = 'published'
     and s.value ->> 'status' = 'done'
     and coalesce(s.value ->> 'srt', '') <> ''
     and not exists (
       select 1 from public.lms_aula_trechos t
        where t.lesson_id = l.id and t.cabecalho
          and t.fonte_atualizada_em is not distinct from nullif(s.value ->> 'atualizadaEm', '')::timestamptz
          and t.criado_em >= coalesce(l.updated_at, l.created_at))
   order by l.updated_at desc nulls last
   limit greatest(1, least(coalesce(p_limite, 10), 50));
$$;

revoke all on function public.lms_aulas_para_indexar(integer) from public, anon, authenticated;
grant execute on function public.lms_aulas_para_indexar(integer) to service_role;


-- ── 5. O rascunho guarda a aula indicada (o painel mostra para quem aprova) ─────────────────────

alter table public.comu_ai_drafts add column if not exists aula_indicada jsonb;

comment on column public.comu_ai_drafts.aula_indicada is
  'Aula que o rascunho indica (20261006000032): {lesson_id, aula, curso, modulo, inicio_s, link, situacao, libera_em, confianca, similaridade}.';


-- ── 6. Link de aula não entra na base de conhecimento ───────────────────────────────────────────
-- A resposta aprovada vira conhecimento para os próximos alunos; a linha com o link da aula sai
-- antes (o próximo aluno pode não ter aquela aula, e o link certo é montado na hora).

create or replace function public.comu_ai_knowledge_sem_link_de_aula()
returns trigger
language plpgsql
as $$
begin
  if new.answer ~ 'giovannipaganini\.com/curso/' then
    new.answer := btrim(regexp_replace(new.answer, '^[^\n]*giovannipaganini\.com/curso/[^\n]*\n?', '', 'gn'));
  end if;
  return new;
end;
$$;

drop trigger if exists comu_ai_knowledge_sem_link_de_aula on public.comu_ai_knowledge;
create trigger comu_ai_knowledge_sem_link_de_aula
  before insert or update of answer on public.comu_ai_knowledge
  for each row execute function public.comu_ai_knowledge_sem_link_de_aula();
