## Problema

No diálogo "Editar Membro" da instância `smartdent_marketing`:
- Evolution API (porta 8080) → 🟢 Conectado (correto)
- Evolution GO (porta 8081) → 🔴 Desconectado (incorreto, o usuário confirma que ambas estão conectadas)

## Causa

`supabase/functions/smart-ops-evogo-status/index.ts` testa a conexão do EvoGo usando os mesmos caminhos da Evolution API tradicional (`/instance/connectionState/{name}`, `/instance/{name}/status`, `/instance/fetchInstances`). O runtime EvoGo (porta 8081) não expõe esses endpoints — o próprio código de webhook (`smart-ops-evogo-groups-webhook`) documenta que EvoGo não tem endpoint de listagem de grupos.

Resultado: todos os attempts caem no `catch` ou retornam não-OK, e a função devolve `state: "close"` mesmo quando a instância está online.

## Solução

Reescrever a lógica de probe em `smart-ops-evogo-status` para detectar corretamente o EvoGo:

1. **Fallback via webhook observado:** se o endpoint `/webhook/find/{instance}` responder 2xx (já é chamado hoje), a instância está online — retornar `state: "open"`.
2. **Sinal de atividade recente:** consultar `sentinela_group_messages` filtrando por `instance_name = evolution_instance_name` e `received_at > now() - interval '10 minutes'`. Se houver eventos recentes, considerar `open` (a instância está entregando webhooks agora).
3. **Ping raiz tolerante:** manter tentativa em `GET /` só para health-check (sem exigir JSON de state).
4. **Ordem de decisão:** webhook 2xx → open; senão eventos recentes → open; senão HTTP raiz 2xx → open; caso contrário `close` com `reason`.
5. Preservar payload atual (`webhook_url`, `webhook_events`, `webhook_enabled`, `http`, `latency_ms`) para não quebrar a UI.

Nenhuma mudança no frontend: `SmartOpsTeam.tsx` já consome `state` e o badge passará a mostrar 🟢 Conectado quando a lógica corrigida retornar `open`.

## Validação

- Reabrir "Editar Membro" para `smartdent_marketing` após deploy — badge Evolution GO deve virar 🟢 Conectado.
- Membro sem credenciais EvoGo continua 🔴 (reason `missing_creds`).
- Nenhum efeito na Evolution API tradicional (função separada).

## Arquivos

- `supabase/functions/smart-ops-evogo-status/index.ts` — reescrita da lógica de probe.
