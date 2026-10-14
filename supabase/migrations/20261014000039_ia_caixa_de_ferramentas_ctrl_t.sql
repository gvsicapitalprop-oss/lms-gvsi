-- Caixa de Ferramentas do MT5 que não aparece com Ctrl+T (pedido do dono em 14/10/2026).
--
-- Problema muito comum. A solução oficial (áudio da equipe, 14/10) é: ela está escondida atrás
-- da barra de tarefas do Windows; ocultar automaticamente a barra de tarefas, arrastar a Caixa de
-- Ferramentas para dentro do MT5 e, se quiser, desativar a opção de novo. A base já tinha essa
-- orientação misturada com respostas fracas, e o prompt dizia só "Ferramentas sumiram → Ctrl+T":
-- no SUP-2026-002103 a IA mandou o aluno procurar a aba "Terminal" (no MT5 em português não
-- existe) e o rascunho foi aprovado e virou base. Aqui: a entrada oficial, a regra no prompt e a
-- entrada errada desligada. O embedding entra sozinho pelo support-embed-tick.

insert into public.comu_ai_knowledge (question, answer, source, tags, enabled)
select 'Apertei Ctrl+T e a Caixa de Ferramentas do MT5 não aparece (a parte de baixo com Negociação, Histórico e o lucro sumiu)',
       'Isso acontece quando a Caixa de Ferramentas fica escondida atrás da barra de tarefas do Windows. Clica com o botão direito na barra de tarefas, vai em Configurações da barra de tarefas e ativa "Ocultar automaticamente a barra de tarefas" (Windows 10 e 11). A barra de tarefas some e a Caixa de Ferramentas aparece embaixo: clica na borda de cima dela e arrasta para dentro do MT5. Depois, se quiser, é só desativar a opção de novo. Reinstalar o MT5 não resolve, e no MT5 em português não existe aba "Terminal": o nome é Caixa de Ferramentas.',
       'solucao_oficial', array['mt5', 'caixa de ferramentas', 'ctrl+t', 'barra de tarefas'], true
where not exists (select 1 from public.comu_ai_knowledge where source = 'solucao_oficial' and 'ctrl+t' = any(tags));

-- a resposta aprovada no SUP-2026-002103 mandava procurar a aba "Terminal"
update public.comu_ai_knowledge set enabled = false where id = 'f3150db7-727d-4c1e-becd-0adc16f79d7c';

do $do$
declare p text;
begin
  select system_prompt into p from public.comu_ai_support_config limit 1;
  if position('Ferramentas sumiram → Ctrl+T.' in p) = 0 then raise exception 'anchor Ctrl+T nao achado'; end if;
  update public.comu_ai_support_config set system_prompt = replace(p, 'Ferramentas sumiram → Ctrl+T.',
    'CAIXA DE FERRAMENTAS (parte de baixo com Negociação, Histórico e lucro): abre com Ctrl+T ou Exibir → Caixa de Ferramentas; no MT5 em português NÃO existe aba "Terminal". Apertou Ctrl+T e não aparece → está escondida atrás da barra de tarefas do Windows: botão direito na barra de tarefas → Configurações da barra de tarefas → ativar "Ocultar automaticamente a barra de tarefas"; a Caixa aparece embaixo, arrastar a borda de cima dela para dentro do MT5; depois pode desativar a opção de novo. Reinstalar o MT5 não resolve.'),
    updated_at = now();
end $do$;
