
# Refatoracao completa das integracoes WaLeads e ManyChat

## Problemas encontrados

### 1. CORS inconsistentes entre edge functions
- `smart-ops-send-waleads` tem CORS completo (com headers extras do Supabase client)
- `smart-ops-cs-processor` e `smart-ops-stagnant-processor` tem CORS incompleto (faltam headers `x-supabase-client-platform`, etc.)

### 2. Header Authorization duplicado/desnecessario no cs-processor
- Linha 176: `"Authorization": \`Bearer \${waleadsApiKey}\`` esta sendo enviado junto com `?key=` na URL
- No `send-waleads` (que funciona), **nao** tem esse header extra
- Isso pode causar conflito na API WaLeads

### 3. Funcao replaceVariables duplicada
- A mesma funcao `replaceVariables` existe identica em `send-waleads` e `cs-processor`
- Ambas podem ser mantidas (funcoes de edge nao compartilham modulos facilmente), mas devem estar identicas

### 4. Log de teste incorreto no SmartOpsTeam
- Linha 212: texto diz "nao sera registrada nos logs" mas na verdade **e registrada** com sufixo `_test`

### 5. stagnant-processor sem integracao WaLeads
- Usa apenas ManyChat para enviar mensagens no funil de estagnacao
- Nao segue o mesmo padrao dual (ManyChat + WaLeads) dos outros processadores

## Plano de correcoes

### Arquivo: `supabase/functions/smart-ops-cs-processor/index.ts`

| Linha | Problema | Correcao |
|---|---|---|
| 5-6 | CORS headers incompletos | Adicionar headers extras do Supabase client |
| 174-176 | Header `Authorization` duplicado | Remover header Authorization da chamada WaLeads (manter apenas `?key=` na URL, igual ao send-waleads) |

**CORS corrigido:**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

**Remover Authorization header (linha 174-176):**
```typescript
// Antes:
headers: {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${waleadsApiKey}`,
},

// Depois (igual ao send-waleads):
headers: {
  "Content-Type": "application/json",
},
```

### Arquivo: `supabase/functions/smart-ops-stagnant-processor/index.ts`

| Linha | Problema | Correcao |
|---|---|---|
| 5-6 | CORS headers incompletos | Adicionar headers extras do Supabase client |

**CORS corrigido:**
```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
```

### Arquivo: `src/components/SmartOpsTeam.tsx`

| Linha | Problema | Correcao |
|---|---|---|
| 212 | Texto diz "nao sera registrada nos logs" | Corrigir para "sera registrada com sufixo _test" |

**Antes:**
```
Modo teste: a mensagem será enviada mas não será registrada nos logs.
```

**Depois:**
```
Modo teste: a mensagem será enviada e registrada nos logs com sufixo _test.
```

## Resumo das alteracoes

| Arquivo | Tipo | Descricao |
|---|---|---|
| `smart-ops-cs-processor/index.ts` | Bug fix | CORS completo + remover Authorization duplicado |
| `smart-ops-stagnant-processor/index.ts` | Bug fix | CORS completo |
| `SmartOpsTeam.tsx` | Texto | Corrigir texto sobre registro de teste |

## Arquivos ja corretos (sem alteracao necessaria)

| Arquivo | Status |
|---|---|
| `smart-ops-send-waleads/index.ts` | OK - CORS completo, sem cleanPhone, formato correto |
| `SmartOpsCSRules.tsx` | OK - referencias corretas |
| `WaLeadsMediaPreview.tsx` | OK |
| `WaLeadsVariableBar.tsx` | OK |
| `SmartOpsSellerAutomations.tsx` | OK - sem referencias WaLeads/ManyChat |
| `SmartOpsLogs.tsx` | OK - apenas leitura de logs |

Apos as correcoes, todas as 3 edge functions terao CORS identico e a chamada WaLeads no cs-processor seguira o mesmo padrao do send-waleads (autenticacao apenas via query param `key`).
