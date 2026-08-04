-- =====================================================================
-- #2 Responder citando + #3 Ver quem reagiu
--   - comu_messages.reply_to / reply_author / reply_snippet: guarda a
--     referência da mensagem citada + um snapshot (autor/trecho) para
--     renderizar a citação sem novo lookup, mesmo se a original não
--     estiver carregada. reply_to some (set null) se a original for apagada.
--   - comu_message_reactions.user_name: nome de quem reagiu (denormalizado,
--     escrito pelo próprio usuário), para mostrar "quem reagiu".
-- =====================================================================
alter table public.comu_messages
  add column if not exists reply_to      uuid references public.comu_messages(id) on delete set null,
  add column if not exists reply_author  text,
  add column if not exists reply_snippet text;

alter table public.comu_message_reactions
  add column if not exists user_name text;
