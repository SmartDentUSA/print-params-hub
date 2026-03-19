

# Diagnóstico: Vendedor ausente em leads do webhook PipeRun

## Causa raiz

O payload do webhook PipeRun envia o responsável pelo deal no campo **`user`**, mas o código em `extractIds()` procura pelo campo **`owner`**.

Prova no banco de dados (lead `odontonato@gmail.com`):
```text
piperun_raw_payload.user = { id: 47802, name: "Lucas Silva", email: "lucas.silva@smartdent.com.br" }
piperun_raw_payload.owner = null (campo não existe)
```

O `extractIds` na linha 36 faz:
```typescript
const owner = deal.owner as Record<string, unknown> | undefined;  // ← sempre undefined
```

Como `owner` é undefined, `ownerName` e `ownerId` ficam null. Consequentemente `proprietario_lead_crm` e `piperun_owner_id` nunca são preenchidos via webhook.

## Correção

### Arquivo: `supabase/functions/smart-ops-piperun-webhook/index.ts` (linha 36)

Adicionar fallback para `deal.user`:

```typescript
const owner = (deal.owner || deal.user) as Record<string, unknown> | undefined;
```

Também adicionar fallback para `owner_id` na linha 45:

```typescript
ownerId: Number(owner?.id || deal.owner_id || deal.user_id) || undefined,
```

### Resultado

- **1 linha alterada** (+ 1 ajuste menor)
- Todos os leads futuros do webhook terão vendedor preenchido
- Leads existentes podem ser corrigidos re-executando o `piperun-full-sync` (que usa `mapDealToAttendance` e já mapeia corretamente via `owner_id`)
- Nenhuma outra seção ou lógica é afetada

