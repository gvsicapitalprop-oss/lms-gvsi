CREATE OR REPLACE FUNCTION public.comu_ai_draft_approve(p_draft_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare d comu_ai_drafts; v_bot uuid; v_topic uuid; v_name text; v_avatar text; v_msg uuid;
        parts text[]; seg text; v_body text; v_video text; v_nome_video text;
begin
  if not lms_is_admin() then raise exception 'forbidden'; end if;
  select * into d from comu_ai_drafts where id=p_draft_id;
  if d.id is null then raise exception 'draft not found'; end if;
  if d.status <> 'pending' then raise exception 'draft already %', d.status; end if;
  select bot_user_id into v_bot from comu_ai_support_config limit 1;
  select id into v_topic from comu_topics where post_policy='support' order by created_at limit 1;
  select coalesce(full_name,'Saymon'), avatar_url into v_name, v_avatar from lms_students where id='e56f879d-2789-4da0-9998-130f9a3bab41';
  -- tira a frase final que so oferece ajuda ("é só avisar", "estou à disposição").
  -- O modelo cola isso em resposta curta mesmo com a regra no prompt; aqui e o
  -- ultimo ponto antes de chegar no aluno. Resposta com link passa intacta.
  v_body := comu_ai_tira_fechamento(comu_ai_corrige_saudacao(coalesce(d.draft_body,'')));
  -- quebra em baloes no separador [MSG] (intencao do prompt): 1 mensagem por trecho, sem o marcador
  -- Tutorial: se a resposta traz o link de um video do catalogo, o aluno recebe o VIDEO,
  -- nao um endereco para copiar. O link sai do texto para a mensagem nao ficar poluida.
  v_video := (regexp_match(v_body, '(https?://[^\s)]+/comu-media/tutoriais/[^\s)]+\.mp4)'))[1];
  if v_video is not null then
    v_nome_video := regexp_replace(v_video, '^.*/', '');
    v_body := btrim(regexp_replace(replace(v_body, v_video, ''), '[ 	]+', ' ', 'g'));
    -- sem o link, sobra um dois-pontos solto: vira uma seta apontando para o video
    v_body := btrim(regexp_replace(v_body, ':[ ]*$', ' 👉'));
  end if;

  parts := regexp_split_to_array(v_body, '\[MSG\]');
  foreach seg in array parts loop
    seg := btrim(seg);
    if seg = '' then continue; end if;
    insert into comu_messages(topic_id, author_id, kind, body, status, ticket_id, author_name, author_avatar)
    values (v_topic, v_bot, 'text', seg, 'sent', d.ticket_id, coalesce(v_name,'Saymon'), v_avatar)
    returning id into v_msg;
  end loop;
  if v_msg is null then
    insert into comu_messages(topic_id, author_id, kind, body, status, ticket_id, author_name, author_avatar)
    values (v_topic, v_bot, 'text', btrim(regexp_replace(v_body,'\[MSG\]',' ','g')), 'sent', d.ticket_id, coalesce(v_name,'Saymon'), v_avatar)
    returning id into v_msg;
  end if;
  if v_video is not null then
    insert into comu_messages(topic_id, author_id, kind, media_url, status, ticket_id, author_name, author_avatar, media_meta)
    values (v_topic, v_bot, 'video', v_video, 'sent', d.ticket_id, coalesce(v_name,'Saymon'), v_avatar,
            jsonb_build_object('mime','video/mp4','name', v_nome_video, 'tutorial', true))
    returning id into v_msg;
  end if;

  -- grava no Cofre ja limpo, senao o filler volta a se acumular como exemplo
  insert into comu_ai_knowledge(question, answer, source, source_draft_id, created_by)
  values (d.member_question, v_body, 'approved', d.id, auth.uid());
  update comu_ai_drafts set status='approved', decided_at=now(), decided_by=auth.uid(), sent_message_id=v_msg where id=d.id;
  update comu_ai_drafts set status='superseded' where ticket_id=d.ticket_id and status='pending' and id<>d.id;
  return v_msg;
end $function$;