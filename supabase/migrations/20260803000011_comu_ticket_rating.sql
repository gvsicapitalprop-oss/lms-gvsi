-- =====================================================================
-- Avaliação do atendimento de suporte (ao finalizar o ticket)
--   rating 1..5 + solved (resolveu?) + rated_at. Como a policy de UPDATE
--   em comu_support_tickets é só admin, o membro avalia via RPC.
-- =====================================================================
alter table public.comu_support_tickets
  add column if not exists rating   smallint check (rating between 1 and 5),
  add column if not exists solved   boolean,
  add column if not exists rated_at timestamptz;

create or replace function public.comu_rate_ticket(p_ticket_id uuid, p_rating int, p_solved boolean)
returns public.comu_support_tickets
language plpgsql security definer set search_path to 'public' as $$
declare
  uid uuid := (select auth.uid());
  tk  public.comu_support_tickets;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  update public.comu_support_tickets
     set rating = greatest(1, least(5, p_rating)),
         solved = p_solved,
         rated_at = now()
   where id = p_ticket_id and user_id = uid
   returning * into tk;
  if not found then raise exception 'ticket not found or not yours'; end if;
  return tk;
end $$;

grant execute on function public.comu_rate_ticket(uuid, int, boolean) to authenticated;
