

# Fix: Watchdog Modo Híbrido + Alertas WhatsApp

## Diagnóstico

Os logs mostram que o watchdog **funciona** (CORS OK, DeepSeek respondendo), mas às vezes **estoura o timeout** porque executa tudo sequencialmente: 4 queries + DeepSeek API (~8s) + re-ingestão de 3 leads (~45s) + trigger de análises cognitivas (~25s) = ~80s total, excedendo o limite de ~60s da Edge Function.

A imagem mostra exatamente isso: o toast "Watchdog executado!" aparece (a função respondeu parcialmente) seguido de "Failed to send a request" (timeout na parte pesada).

## Solução: Modo Híbrido

### 1. Refatorar `system-watchdog-deepseek/index.ts`

Adicionar parâmetro `mode`:
- **`audit`** (default do botão): Apenas queries + DeepSeek analysis. Retorna em <10s. Sem remediação.
- **`full`** (usado pelo cron): Audit + auto-remediação + triggers cognitivos.

```
POST { mode: "audit" }  → resposta rápida (~8s)
POST { mode: "full" }   → execução completa (cron, sem timeout do browser)
```

### 2. Alerta WhatsApp para Críticos

Quando `mode === "full"` e a análise do DeepSeek classifica como `severity: "critical"`:
- Enviar WhatsApp via `smart-ops-send-waleads` para o primeiro admin ativo da equipe
- Mensagem: resumo da análise + contagem de anomalias

### 3. Botão "Corrigir" separado no Dashboard

O `SmartOpsSystemHealth.tsx` terá:
- **"Executar Auditoria"** → chama `mode: "audit"` (rápido, nunca falha por timeout)
- **"Corrigir Órfãos"** → chama `mode: "full"` com feedback de progresso

### 4. Fix CORS em `smart-ops-ingest-lead`

A function `smart-ops-ingest-lead` ainda usa CORS incompleto (linha 6). Corrigir para evitar falhas quando chamada cross-origin.

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/functions/system-watchdog-deepseek/index.ts` | Refatorar com parâmetro `mode` (audit/full); adicionar alerta WhatsApp em critical |
| `src/components/SmartOpsSystemHealth.tsx` | Separar botões "Auditoria" e "Corrigir"; melhorar feedback de loading |
| `supabase/functions/smart-ops-ingest-lead/index.ts` | Fix CORS headers |

