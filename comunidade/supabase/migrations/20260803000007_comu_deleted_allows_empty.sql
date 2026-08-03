-- Soft delete limpa body/media; a constraint has_content precisa permitir isso.
alter table public.comu_messages drop constraint if exists comu_messages_has_content;
alter table public.comu_messages add constraint comu_messages_has_content check (
  body is not null or media_url is not null or kind = 'system' or status = 'deleted'
);
