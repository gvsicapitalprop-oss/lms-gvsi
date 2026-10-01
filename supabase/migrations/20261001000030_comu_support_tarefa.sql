-- Tarefa manual pendente da equipe no atendimento (hoje: ativar_mesa).
-- Vira etiqueta na lista e entra na aba URGENTE.
alter table public.comu_support_tickets add column if not exists tarefa text;
comment on column public.comu_support_tickets.tarefa is 'Tarefa manual pendente da equipe neste atendimento (ex.: ativar_mesa). Aparece como etiqueta e cai na aba URGENTE.';
create index if not exists comu_support_tickets_tarefa_idx on public.comu_support_tickets (tarefa) where tarefa is not null;
