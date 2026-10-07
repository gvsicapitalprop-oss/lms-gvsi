-- A IA do suporte responde sozinha em conteúdo e plataforma, com travas (pedido do dono, 06/10/2026)
--
-- "Pode abrir mais o leque da nossa IA para que ela consiga responder mais dúvidas por conta
-- própria e vamos ampliar junto também a segurança caso ela não esteja conseguindo ajudar alguém,
-- garantir que ela não fique sempre rendendo com mensagens [...] 'Vou chamar uma pessoa da equipe,
-- só um momento' [...] 10, 20 vezes." Decisões do dono: conteúdo e plataforma; liga já, com as travas.
--
-- Este arquivo:
--   1. Liga/desliga e limites em comu_ai_support_config (auto_resposta_*), e o motivo de cada
--      decisão no rascunho (comu_ai_drafts.auto_decisao).
--   2. Busca de aulas que também olha o NOME da aula (a simulação de 06/10 mostrou que "objetivos do
--      Giovanni" não achava "Meu Objetivo" só pelo vetor) e prefere aula que o aluno já pode abrir.
--   3. comu_ai_draft_auto_enviar envia também a resposta da IA e o aviso de que a equipe vai
--      responder, com a trava no próprio banco: no máximo 3 respostas sozinha por atendimento em
--      24 h e 1 aviso de equipe a cada 12 h, mesmo que a função do suporte erre.
-- As regras de quando responder sozinha moram na função support-draft (autonomia.ts).

set local search_path = public, extensions;


-- ── 1. Liga/desliga e limites ────────────────────────────────────────────────────────────────────

alter table public.comu_ai_support_config
  add column if not exists auto_resposta_enabled boolean not null default false,
  add column if not exists auto_resposta_categorias text[] not null default '{conteudo,plataforma}',
  add column if not exists auto_resposta_max_dia integer not null default 3,
  add column if not exists draft_model_auto text;

comment on column public.comu_ai_support_config.auto_resposta_enabled is
  'A IA envia sozinha a resposta de conteúdo/plataforma que passar pelas travas (20261007000033). Desligado = tudo volta a passar pela aprovação.';

alter table public.comu_ai_drafts add column if not exists auto_decisao jsonb;

comment on column public.comu_ai_drafts.auto_decisao is
  'Por que a IA enviou (ou não) sozinha: {auto, aviso, motivo, juiz, base} (20261007000033).';


-- ── 2. Busca que também olha o nome da aula ──────────────────────────────────────────────────────

create or replace function public.lms_palavras_do_titulo(p text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct w), '{}')
    from regexp_split_to_table(
           translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
           '[^a-z0-9]+') w
   where length(w) >= 4
     and w not in ('aula', 'aulas', 'parte', 'como', 'para', 'sobre', 'qual', 'quais', 'minha', 'fazer',
                   'voce', 'voces', 'esse', 'essa', 'isso', 'tudo', 'mais', 'muito', 'entre', 'depois',
                   'antes', 'quando', 'porque', 'completo', 'pratica', 'pratico', 'video', 'modulo',
                   'sala', 'vivo', 'curso', 'introducao', 'bonus');
$$;

drop function if exists public.lms_buscar_aulas(vector, uuid, integer);

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
           row_number() over (partition by t.lesson_id order by t.embedding <=> p_embedding) as ordem
      from public.lms_aula_trechos t
     where t.embedding is not null
  ), pontuadas as (
    select c.*, l.title, l.course_id,
           -- cada palavra do nome da aula que aparece na pergunta vale 0,12 (até 2 palavras)
           least(2, (select count(*) from unnest(public.lms_palavras_do_titulo(l.title)) w, pergunta p
                      where p.t <> '' and position(w in p.t) > 0)) * 0.12 as b_titulo
      from candidatos c
      join public.lms_lessons l on l.id = c.lesson_id and l.status = 'published'
      join public.lms_courses cu on cu.id = l.course_id and cu.status = 'published'
      left join public.lms_modules m on m.id = l.module_id
     where c.ordem = 1 and (m.id is null or m.status = 'published')
  ), com_situacao as (
    select p.*, s.situacao, s.libera_em,
           -- entre aulas parecidas, a que o aluno já abre vem antes
           p.b_titulo + case when s.situacao = 'liberada' then 0.05 else 0 end as b_total
      from pontuadas p
      cross join lateral public.lms_aula_situacao(p_aluno, p.lesson_id) s
  )
  select b.lesson_id, cu.title, cu.slug, m.title, l.title, l.slug,
         case when b.cabecalho then 0 else b.inicio_s end, b.texto, b.sim,
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


-- ── 3. Envio automático: cortesia, resposta e aviso de equipe, com a trava no banco ─────────────

create or replace function public.comu_ai_draft_auto_enviar(p_draft_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  d comu_ai_drafts; v_cfg record; v_topic uuid; v_name text; v_avatar text; v_msg uuid;
  v_body text; v_tipo text; parts text[]; seg text;
begin
  select * into d from comu_ai_drafts where id = p_draft_id;
  if d.id is null then raise exception 'draft not found'; end if;
  if d.status <> 'pending' then raise exception 'draft already %', d.status; end if;

  v_tipo := case d.model when 'auto-resposta' then 'resposta' when 'aviso-equipe' then 'aviso_equipe' else 'cortesia' end;
  select auto_cortesia_enabled, auto_resposta_enabled, auto_resposta_max_dia, bot_user_id into v_cfg
    from comu_ai_support_config limit 1;
  if v_tipo = 'cortesia' and not coalesce(v_cfg.auto_cortesia_enabled, false) then raise exception 'auto desligado'; end if;
  if v_tipo <> 'cortesia' and not coalesce(v_cfg.auto_resposta_enabled, false) then raise exception 'auto desligado'; end if;

  -- a trava também mora aqui: a função do suporte confere antes, mas o banco não confia
  if v_tipo = 'resposta' and (
       select count(*) from comu_messages
        where ticket_id = d.ticket_id and media_meta ->> 'auto' = 'resposta' and created_at > now() - interval '24 hours'
     ) >= coalesce(v_cfg.auto_resposta_max_dia, 3) then
    raise exception 'teto de respostas automaticas';
  end if;
  if v_tipo = 'aviso_equipe' and exists (
       select 1 from comu_messages
        where ticket_id = d.ticket_id and media_meta ->> 'auto' = 'aviso_equipe' and created_at > now() - interval '12 hours'
     ) then
    raise exception 'aviso de equipe ja enviado';
  end if;

  v_body := btrim(coalesce(d.draft_body, ''));
  if v_body = '' then raise exception 'draft vazio'; end if;
  if v_tipo = 'resposta' then
    v_body := comu_ai_tira_fechamento(comu_ai_corrige_saudacao(v_body));
  end if;

  select id into v_topic from comu_topics where post_policy = 'support' order by created_at limit 1;
  select coalesce(full_name, 'Saymon'), avatar_url into v_name, v_avatar
    from lms_students where id = 'e56f879d-2789-4da0-9998-130f9a3bab41';

  -- um balão por trecho [MSG], como na aprovação
  parts := regexp_split_to_array(v_body, '\[MSG\]');
  foreach seg in array parts loop
    seg := btrim(seg);
    if seg = '' then continue; end if;
    insert into comu_messages(topic_id, author_id, kind, body, status, ticket_id, author_name, author_avatar, media_meta)
    values (v_topic, v_cfg.bot_user_id, 'text', seg, 'sent', d.ticket_id, coalesce(v_name, 'Saymon'), v_avatar,
            jsonb_build_object('auto', v_tipo, 'draft_id', d.id))
    returning id into v_msg;
  end loop;
  if v_msg is null then raise exception 'draft vazio'; end if;

  -- resposta automática NÃO entra na base de conhecimento: só o que uma pessoa aprovou ou editou
  update comu_ai_drafts
     set status = 'approved', auto_enviado = true, decided_at = now(), decided_by = v_cfg.bot_user_id, sent_message_id = v_msg
   where id = d.id;
  return v_msg;
end
$function$;
