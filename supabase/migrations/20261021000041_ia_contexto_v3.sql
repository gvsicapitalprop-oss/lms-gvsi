-- IA do suporte: chave do contexto v3 (21/10/2026). Ligado por padrao; false faz a
-- support-draft voltar para a janela antiga (22 mensagens misturadas, sem o resumo do
-- estado do atendimento), sem precisar publicar a funcao de novo.
alter table public.comu_ai_support_config
  add column if not exists contexto_v3 boolean not null default true;
