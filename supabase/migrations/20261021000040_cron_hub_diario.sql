-- Conferência Hub -> Diário de Trading a cada 10 minutos (21/10/2026).
-- A hub-diario lê no Hub quem tem direito ao Diário (assinatura paga de fato ou bônus ativo)
-- e manda a lista completa para o billing-webhook do Diário (action "sync"). Mesmo desenho
-- dos outros crons de serviço deste projeto (net.http_post com x-mod-secret).
select cron.unschedule('hub-diario') where exists (select 1 from cron.job where jobname = 'hub-diario');
select cron.schedule('hub-diario', '*/10 * * * *', $c$
  select net.http_post(timeout_milliseconds := 120000,
    url := 'https://mwnyuursbrlfxfssvkyu.supabase.co/functions/v1/hub-diario',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-mod-secret','29cd994b17c3a8c1f6800341e0c1f25ddad047cc345d83a3'));
$c$);
