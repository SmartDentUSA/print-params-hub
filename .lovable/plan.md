## Diagnóstico

- Instância `smartdent_marketing_evogo` está de fato conectada. O runtime EvoGo (`http://82.25.75.61:8081`) responde 404 em `/webhook/find/{instance}` e em `/` — por isso o probe atual devolve `close` mesmo com a instância online.
- Endpoint correto descoberto por probing: `GET /instance/status` com header `apikey: <evo_go_instance_token>` retorna:
  ```json
  {"data":{"Connected":true,"LoggedIn":true,"Name":"Smart Dent Marketing"},"message":"success"}
  ```
- Não há `{instance}` no path — o token já identifica a instância (padrão wuzapi-like).

## Correção

Ajustar `supabase/functions/smart-ops-evogo-status/index.ts` para usar `/instance/status` como probe primário:

1. `GET {base}/instance/status` com header `apikey: <evo_go_instance_token>`, timeout 6s.
2. Parse do JSON: considerar `state: "open"` quando `data.Connected === true` E `data.LoggedIn === true`. Retornar `probe: "instance_status"` e incluir `data.Name` no payload como `instance_display_name` para diagnóstico.
3. Se `Connected` ou `LoggedIn` for falso → `state: "close"` com `reason: "not_logged_in"` (ou `"not_connected"`).
4. Manter como fallback secundário a checagem de `sentinela_group_messages` (10 min) — se o `/instance/status` falhar por rede/timeout mas eventos recentes existirem, ainda retorna `open` com `probe: "recent_webhook_events"`.
5. Remover os probes hoje quebrados: `/webhook/find/{instance}` e `GET /` (voltam sempre 404 e sujam os logs).
6. Preservar payload atual (`http`, `latency_ms`, `webhook_url/events/enabled` como `null`) para não quebrar a UI existente em `SmartOpsTeam.tsx`.

Nenhuma mudança no frontend.

## Validação

- Reabrir "Editar Membro" para `smartdent_marketing`: badge Evolution GO deve virar 🟢 Conectado.
- Instância deslogada continua 🔴 com `reason: not_logged_in`.
- Membro sem `evo_go_instance_token` continua 🔴 com `reason: missing_creds` (comportamento já existente).

## Arquivos

- `supabase/functions/smart-ops-evogo-status/index.ts` — trocar probe primário para `/instance/status`.
