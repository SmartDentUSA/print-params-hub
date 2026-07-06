## Objetivo
Adicionar um indicador de conexão (Conectado / Desconectado) para a seção **Configurações Evolution GO** no modal de Team Members, espelhando o comportamento já existente na seção Evolution API.

## Como vai funcionar
- No cabeçalho da seção "Configurações Evolution GO" aparece um badge:
  - 🟢 **Conectado** — EvoGo respondeu OK
  - 🔴 **Desconectado** — falha / credenciais ausentes / instância inválida
  - ⚪ **Verificando…** — enquanto o check inicial roda
- O status é buscado ao abrir o modal de edição (se o membro já tiver `evo_go_instance_id` + `evo_go_instance_token` cadastrados), e também sempre que o usuário clicar no badge para forçar re-check.

## Alterações

### 1. Nova edge function `smart-ops-evogo-status`
- Recebe `{ member_id }` no body.
- Lê de `team_members`: `evo_go_base_url`, `evo_go_instance_token`, `evo_go_instance_id`, `evolution_api_key` (fallback quando o token dedicado do EvoGo não estiver preenchido — mesma lógica de `smart-ops-integration-check`).
- Faz `GET ${base}/instance/fetchInstances` com header `apikey`. Retorna `{ state: "open" | "close", http, latency_ms }`.
- Se faltar `base` ou credencial, devolve `{ state: "close", reason: "missing_creds" }`.
- Sem alteração de dados; sem RLS envolvida (usa service role apenas para ler as credenciais).

### 2. `src/components/SmartOpsTeam.tsx` (somente frontend)
- Reutilizar o mesmo componente `EvolutionStatusBadge`, sob um segundo estado `evoGoStatus` (`open` / `close` / `unknown`).
- Adicionar wrapper `flex items-center justify-between` no cabeçalho "Configurações Evolution GO" para exibir o badge à direita, igual ao Evolution.
- No `openEdit`, se `m.evo_go_instance_token` (ou `m.evo_go_instance_id`) estiver preenchido, chamar `supabase.functions.invoke("smart-ops-evogo-status", { body: { member_id: m.id } })` e setar `evoGoStatus`.
- No `openAdd`, resetar `evoGoStatus = "unknown"`.
- Clicar no badge dispara re-check (mesma função).

## O que NÃO muda
- Nada em `wa-dispatcher`, `smart-ops-integration-check`, migrations, RLS, tabelas ou lógica de envio.
- Nenhuma outra parte do modal (campos, ordem, provider select).
