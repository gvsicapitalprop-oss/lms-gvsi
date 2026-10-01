-- Atraso humano na resposta automática de cortesia.
-- O rascunho nasce agendado; um tick por minuto envia o que já venceu.
alter table public.comu_ai_drafts add column if not exists auto_enviar_em timestamptz;
comment on column public.comu_ai_drafts.auto_enviar_em is 'Quando a resposta automatica de cortesia deve sair. Nulo = nao e envio automatico.';
create index if not exists comu_ai_drafts_auto_em_idx on public.comu_ai_drafts (auto_enviar_em) where auto_enviar_em is not null;

create or replace function public.comu_ai_cortesia_tick()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare r record; v_enviadas int := 0;
begin
  for r in
    select d.id, d.ticket_id, d.created_at
      from comu_ai_drafts d
     where d.status = 'pending'
       and d.auto_enviar_em is not null
       and d.auto_enviar_em <= now()
     order by d.auto_enviar_em
     limit 50
  loop
    -- Chegou mensagem nova depois do agendamento? A cortesia perdeu a hora:
    -- se foi o aluno, ele ja falou outra coisa; se fomos nos, a conversa andou.
    if exists (
      select 1 from comu_messages m
       where m.ticket_id = r.ticket_id
         and m.created_at > r.created_at
         and coalesce(m.status, 'sent') <> 'deleted'
    ) then
      update comu_ai_drafts set status = 'superseded' where id = r.id;
      continue;
    end if;

    begin
      perform comu_ai_draft_auto_enviar(r.id);
      v_enviadas := v_enviadas + 1;
    exception when others then
      update comu_ai_drafts set status = 'superseded' where id = r.id;
    end;
  end loop;
  return v_enviadas;
end
$function$;

revoke all on function public.comu_ai_cortesia_tick() from public, anon, authenticated;

select cron.schedule('comu-cortesia-tick', '* * * * *', 'select public.comu_ai_cortesia_tick()');
