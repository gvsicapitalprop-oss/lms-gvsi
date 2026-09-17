-- Remove as tags de suporte (pedido do dono em 17/09/2026).
-- A IA adicionava tags automaticamente; as triggers abaixo descartam qualquer
-- insert/update de FORMA SILENCIOSA (funciona até para a service_role usada
-- pelas edge functions), sem quebrar a função que tentava inserir.
-- As tabelas permanecem por compatibilidade; os dados existentes são apagados.

create or replace function public.comu_block_support_tags()
returns trigger language plpgsql as $$
begin
  return null; -- descarta silenciosamente
end;
$$;

drop trigger if exists comu_no_contact_tags on public.comu_support_contact_tags;
create trigger comu_no_contact_tags
  before insert or update on public.comu_support_contact_tags
  for each row execute function public.comu_block_support_tags();

drop trigger if exists comu_no_support_tags on public.comu_support_tags;
create trigger comu_no_support_tags
  before insert or update on public.comu_support_tags
  for each row execute function public.comu_block_support_tags();

-- limpa o que já existe
delete from public.comu_support_contact_tags;
delete from public.comu_support_tags;
