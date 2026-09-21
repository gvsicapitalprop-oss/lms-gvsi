-- 1) comu_ai_redraft_stale passa force=true (a guarda anti-redraft do
--    support-draft v25 sem isso ignoraria a regeneracao de rascunhos velhos)
do $do$
declare b text;
begin
  select pg_get_functiondef(p.oid) into b from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'comu_ai_redraft_stale' and n.nspname = 'public';
  b := replace(b,
    $$jsonb_build_object('ticket_id', r.ticket_id, 'trigger_message_id', r.trigger_message_id)$$,
    $$jsonb_build_object('ticket_id', r.ticket_id, 'trigger_message_id', r.trigger_message_id, 'force', true)$$);
  if b not like '%''force'', true%' then raise exception 'anchor redraft nao achado'; end if;
  execute b;
end $do$;

-- 2) dispatch: video tambem gera sugestao; "segura ai" curto nao cancela pendente
do $do$
declare b text;
begin
  select pg_get_functiondef(p.oid) into b from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where p.proname = 'comu_support_draft_dispatch' and n.nspname = 'public';
  b := replace(b,
    $$if NEW.kind not in ('text','image','audio') then return null; end if;$$,
    $$if NEW.kind not in ('text','image','audio','video') then return null; end if;$$);
  b := replace(b,
    $$update public.comu_ai_drafts set status='superseded' where ticket_id = NEW.ticket_id and status='pending';$$,
    $$if not (NEW.kind = 'text' and NEW.body is not null and length(trim(NEW.body)) < 200 and trim(NEW.body) ~* '(verificar|vou olhar|ja te retorno|ja retorno|um instante|so um momento|aguenta|estou olhando|vou checar|deixa eu ver|deixa eu conferir)') then update public.comu_ai_drafts set status='superseded' where ticket_id = NEW.ticket_id and status='pending'; end if;$$);
  if b not like '%audio'',''video''%' then raise exception 'anchor kinds nao achado'; end if;
  if b not like '%deixa eu conferir%' then raise exception 'anchor hold nao achado'; end if;
  execute b;
end $do$;
