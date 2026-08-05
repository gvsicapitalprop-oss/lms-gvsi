# Orquestrador de IA (Bruno) — Suporte da Comunidade

Serviço Node que faz a IA **Bruno** atender os alunos no menu **Suporte** da comunidade,
**sem o aluno saber que é IA**, com **handoff silencioso** pra um humano.

## Fluxo
Aluno manda msg no Suporte → o worker (realtime do Supabase) pega → chama o cérebro
(**n8n**, persona `barbara`, histórico do ticket no `body.history`) → grava a resposta do
**Bruno** em `comu_messages` (o aluno vê em tempo real). Conta `ai_attempts`; se a IA pedir
handoff, estourar `max_attempts`, OU o cérebro falhar → marca `needs_human=true` + `ai_active=false`
(handoff silencioso) e para de responder.

## Roda na VPS `srv1509275` em `/docker/comu-ai-suporte`
```bash
docker compose build && docker compose up -d
docker logs comu-ai-suporte --tail 20
```
Precisa de `.env` (NÃO versionado):
```
SUPABASE_URL=https://mwnyuursbrlfxfssvkyu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role da comunidade>
N8N_WEBHOOK_URL=<mesmo do agente-chat>
AGENT_TOKEN=<mesmo do agente-chat>
```

## KILL SWITCH e config
Tudo em `comu_ai_support_config` (singleton id=1). **Começa `enabled=false`.** Pra ligar:
```sql
update public.comu_ai_support_config set enabled = true where id = 1;
```
O worker relê a config a cada 30s. Colunas: `enabled`, `persona` (`barbara`=Bruno),
`max_attempts` (4), `hold_message`, `bot_user_id` (o "Bruno").

## Pendente (frontend)
Console de suporte: badge/filtro pros tickets `needs_human`, e quando o humano assumir um
ticket do Bruno, postar **como "Bruno"** (mesma identidade) pra manter a ilusão.
