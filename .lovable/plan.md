
# Corrigir referencia a `cleanPhone` no console.log

## Problema

Na linha 92 do `smart-ops-send-waleads/index.ts`, o `console.log` ainda usa a variavel `cleanPhone` que foi removida na correcao anterior:

```typescript
console.log(`[send-waleads] Sending ${tipo} to ${cleanPhone} via ${member.nome_completo}`, { test_mode });
```

Isso causa o `ReferenceError: cleanPhone is not defined` que impede a funcao de executar.

## Correcao

Substituir `cleanPhone` por `phone` na linha 92:

```typescript
console.log(`[send-waleads] Sending ${tipo} to ${phone} via ${member.nome_completo}`, { test_mode });
```

## Arquivo

| Arquivo | Linha | Mudanca |
|---|---|---|
| `supabase/functions/smart-ops-send-waleads/index.ts` | 92 | Trocar `cleanPhone` por `phone` no console.log |

Apos o deploy, a funcao vai parar de dar erro e finalmente enviar a mensagem para a API WaLeads.
