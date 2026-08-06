-- =====================================================================
-- Correções de escalonamento de permissões (auditoria 05/08/2026).
-- =====================================================================

-- [CRÍTICO] Impede não-admin de definir/alterar o próprio cargo (role).
-- Fechava a brecha: as policies de INSERT/UPDATE de lms_students só checavam
-- auth.uid()=id, sem travar a coluna role → qualquer membro fazia
-- `update lms_students set role='admin'` (ou upsert no 1º login) e virava admin.
-- Admin de verdade e service_role/SQL seguem mudando cargos normalmente.
create or replace function public.lms_role_write_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare caller uuid := (select auth.uid());
begin
  if caller is not null and not public.lms_is_admin() then
    if TG_OP = 'INSERT' then
      NEW.role := 'student';                                  -- ninguém nasce admin
    elsif TG_OP = 'UPDATE' and NEW.role is distinct from OLD.role then
      NEW.role := OLD.role;                                   -- não muda o próprio cargo
    end if;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_lms_role_guard on public.lms_students;
create trigger trg_lms_role_guard before insert or update on public.lms_students
  for each row execute function public.lms_role_write_guard();

-- [MÉDIO] Só o DONO gerencia a allowlist de quem pode banir (antes: qualquer admin).
drop policy if exists "banners: admin gerencia" on public.comu_banners;
drop policy if exists "banners: dono gerencia" on public.comu_banners;
create policy "banners: dono gerencia" on public.comu_banners for all to authenticated
  using (exists (select 1 from public.comu_owners o where o.user_id = (select auth.uid())))
  with check (exists (select 1 from public.comu_owners o where o.user_id = (select auth.uid())));

-- [BAIXO] comu_send_support_message: nome do autor vem do PERFIL REAL (ignora
-- p_author_name — anti-spoof de "Bruno") e kind nunca é 'system' vindo do cliente.
create or replace function public.comu_send_support_message(
  p_body text, p_kind text default 'text', p_media_url text default null, p_author_name text default null)
returns public.comu_messages
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  v_topic uuid; v_name text; v_kind text;
  tk public.comu_support_tickets; msg public.comu_messages;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select full_name into v_name from public.lms_students where id = uid;
  v_kind := coalesce(p_kind, 'text');
  if v_kind not in ('text','image','audio','video','file') then v_kind := 'text'; end if;
  select id into v_topic from public.comu_topics where slug = 'suporte';
  select * into tk from public.comu_support_tickets
    where user_id = uid and status = 'aberto' order by created_at desc limit 1;
  if not found then
    insert into public.comu_support_tickets (protocol, user_id, status, subject)
      values ('SUP-'||to_char(now(),'YYYY')||'-'||lpad(nextval('public.comu_protocol_seq')::text,6,'0'),
              uid, 'aberto', left(coalesce(p_body,''), 80))
      returning * into tk;
  end if;
  insert into public.comu_messages (topic_id, author_id, ticket_id, kind, body, media_url, author_name)
    values (v_topic, uid, tk.id, v_kind, p_body, p_media_url, coalesce(v_name, p_author_name))
    returning * into msg;
  return msg;
end $$;
grant execute on function public.comu_send_support_message(text,text,text,text) to authenticated;
