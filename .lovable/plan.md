## Objetivo
Pausar (não remover) o disparo WaLeads em `supabase/functions/smart-ops-lia-assign/index.ts` via flag `WALEADS_ENABLED = false`. Reativável trocando para `true`.

## Mudanças (somente esse arquivo)

### 1. Flag global (após linha 29, depois dos imports)
```ts
const WALEADS_ENABLED = false; // Pausado — usar Evolution API (smart-ops-lead-welcome + smart-ops-lia-notify-seller)
```

### 2. Call site `triggerOutboundMessages` (linha 2613)
Envolver na flag:
```ts
if (WALEADS_ENABLED) {
  await triggerOutboundMessages(supabase, SUPABASE_URL, SERVICE_ROLE_KEY, lead, assignedTeamMemberId, assignedOwnerName);
}
```

### 3. Priorização WaLeads em `pickRandomActiveVendedor` (linhas 827-839)
Comentar o bloco que filtra por `waleads_api_key` e o `if (waMembers && waMembers.length > 0) { ... return ... }` correspondente, prefixando com:
```ts
// WALEADS_ENABLED: priorização por WaLeads pausada
// if (WALEADS_ENABLED) { ... lógica original abaixo ... }
```
A função cai direto no fallback "any active vendedor" (linhas 842+). Nada deletado — só comentado.

## Não vou mexer
- Nenhuma função (`sendWaLeadsMessage`, `sendTemplateMessage`, `triggerOutboundMessages`) será removida.
- `_shared/waleads-messaging.ts` intacto.
- Nenhuma outra edge function.
- Banco intacto.

## Validação
- `rg -n "WALEADS_ENABLED" supabase/functions/smart-ops-lia-assign/index.ts` deve retornar 3 ocorrências (declaração + call site + comentário no picker).
- Build TS deve passar.

Pode aprovar que eu já aplico.