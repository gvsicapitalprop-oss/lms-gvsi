-- A IA aprende com o atendimento humano no suporte (17/09/2026).
-- 1) Resposta humana DIRETA (sem passar pela IA): a mensagem da equipe que
--    responde o aluno vira par pergunta→resposta em comu_ai_knowledge.
--    O embedding é gerado pelo cron support-embed automaticamente.
-- 2) Correções (comu_ai_corrections) com corrected_answer também alimentam a base.

create or replace function public.comu_learn_from_support()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_member uuid;
  v_prev record;
  v_q text;
  v_a text;
begin
  if new.ticket_id is null or new.kind <> 'text' then return new; end if;
  if new.body is null or length(trim(new.body)) < 15 then return new; end if;
  -- mensagens de "segura aí" não são respostas
  if length(trim(new.body)) < 200 and new.body ~* '(verificar|vou olhar|ja te retorno|ja retorno|um instante|so um momento|aguenta|estou olhando|vou checar|deixa eu ver|deixa eu conferir)' then return new; end if;
  select user_id into v_member from public.comu_support_tickets where id = new.ticket_id;
  if v_member is null or new.author_id = v_member then return new; end if;
  -- só aprende respostas DIRETAS: a mensagem anterior do ticket é do aluno
  -- (tolera UMA mensagem curta da equipe no meio, ex.: "deixa eu verificar")
  select * into v_prev from public.comu_messages
   where ticket_id = new.ticket_id and id <> new.id
   order by created_at desc limit 1;
  if v_prev is null or v_prev.author_id <> v_member then
    if v_prev is not null and v_prev.kind = 'text' and coalesce(length(trim(v_prev.body)), 0) < 60 then
      select * into v_prev from public.comu_messages
       where ticket_id = new.ticket_id and id <> new.id and id <> v_prev.id
       order by created_at desc limit 1;
    else
      return new;
    end if;
  end if;
  if v_prev is null or v_prev.author_id <> v_member then return new; end if;
  v_q := trim(coalesce(v_prev.body, v_prev.media_meta ->> 'transcript', ''));
  if length(v_q) < 4 then return new; end if;
  -- saudações/agradecimentos do aluno não são perguntas
  if v_q ~* '^(bom dia|boa tarde|boa noite|oi+|ola+|opa|e ai+|ok+|obrigad[a|o]*|valeu|entendi|beleza|tranquilo|show|perfeito|certo|blz|tmj|de nada)' then return new; end if;
  v_q := left(v_q, 2000);
  v_a := left(trim(new.body), 4000);
  -- dedupe: mesma pergunta aprendida nas últimas 24h (aprovação de draft já grava)
  if exists (select 1 from public.comu_ai_knowledge where question = v_q and created_at > now() - interval '24 hours') then return new; end if;
  insert into public.comu_ai_knowledge (question, answer, source, enabled, created_by)
  values (v_q, v_a, 'human_direct', true, new.author_id);
  return new;
end $$;

drop trigger if exists comu_learn_from_support_t on public.comu_messages;
create trigger comu_learn_from_support_t
  after insert on public.comu_messages
  for each row execute function public.comu_learn_from_support();

-- correção com resposta corrigida vira conhecimento
create or replace function public.comu_learn_from_correction()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_q text;
  v_a text;
begin
  if new.corrected_answer is null or length(trim(new.corrected_answer)) < 15 then return new; end if;
  if new.member_question is null or length(trim(new.member_question)) < 4 then return new; end if;
  v_q := left(trim(new.member_question), 2000);
  v_a := left(trim(new.corrected_answer), 4000);
  if exists (select 1 from public.comu_ai_knowledge where question = v_q and answer = v_a) then return new; end if;
  insert into public.comu_ai_knowledge (question, answer, source, enabled, created_by)
  values (v_q, v_a, 'correction', true, new.created_by);
  return new;
end $$;

drop trigger if exists comu_learn_from_correction_t on public.comu_ai_corrections;
create trigger comu_learn_from_correction_t
  after insert on public.comu_ai_corrections
  for each row execute function public.comu_learn_from_correction();
