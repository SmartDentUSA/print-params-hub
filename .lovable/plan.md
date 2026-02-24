

# Funis de Estagnacao Automatizados via CRM (Piperun)

## Fluxo completo

O vendedor move o lead para a etapa "Estagnado" no Piperun. O webhook/sync do Piperun ja atualiza o campo `status_atual_lead_crm` no Supabase. O sistema precisa:

1. **Detectar** que `status_atual_lead_crm` mudou para "Estagnado" (via webhook Piperun)
2. **Iniciar** o funil setando `lead_status = est1_0` automaticamente
3. **Avancar** a cada 5 dias: `est1_0 -> est1_1 -> ... -> est1_5 -> est2_0 -> ... -> est3_5 -> estagnado_final`
4. **Enviar mensagem** ManyChat em cada avanco
5. **Parar** se o vendedor mover o lead de volta no CRM (status muda de "Estagnado" para outra etapa)

```text
Piperun CRM: vendedor move para "Estagnado"
       |
       v  (webhook detecta)
  lead_status = est1_0  -->  mensagem ManyChat
       |  (5 dias)
  lead_status = est1_1  -->  mensagem ManyChat
       |  (5 dias)
       ...
  lead_status = est3_5  -->  mensagem final
       |
  lead_status = estagnado_final
```

Se a qualquer momento o vendedor mover o lead para outra etapa no Piperun (ex: "Em Contato"), o webhook atualiza `status_atual_lead_crm` e o `lead_status` volta ao pipeline principal. O processor ignora leads que nao estao mais com status `est*`.

---

## Alteracoes

### 1. Webhook Piperun -- detectar "Estagnado"

**Arquivo: `supabase/functions/smart-ops-piperun-webhook/index.ts`**

Apos atualizar `status_atual_lead_crm`, adicionar logica:
- Se `stageName` contem "Estagnado" (case-insensitive) E `lead_status` atual NAO comeca com `est`:
  - Setar `lead_status = "est1_0"` e `updated_at = now()`
- Se `stageName` NAO contem "Estagnado" E `lead_status` atual comeca com `est`:
  - Mapear o `stageName` de volta para o `lead_status` do pipeline principal (ex: "Em Contato" -> "em_contato")
  - Isso "resgata" o lead do funil de estagnacao

### 2. Sync Piperun -- mesma logica para sync periodico

**Arquivo: `supabase/functions/smart-ops-sync-piperun/index.ts`**

Adicionar a mesma logica de deteccao apos o update:
- Buscar o `lead_status` atual do lead antes de atualizar
- Se `stageName` = "Estagnado" e lead nao esta em funil est*, setar `lead_status = "est1_0"`
- Se `stageName` != "Estagnado" e lead esta em funil est*, mapear de volta ao pipeline

### 3. Processor de estagnacao -- avanco automatico + mensagens

**Arquivo: Novo `supabase/functions/smart-ops-stagnant-processor/index.ts`**

Edge function chamada periodicamente:

1. Busca leads com `lead_status LIKE 'est%'` (exclui `estagnado_final`)
2. Para cada lead, verifica se `updated_at` tem 5+ dias
3. Se sim:
   - Calcula proxima etapa (`est1_0` -> `est1_1`, `est1_5` -> `est2_0`, `est3_5` -> `estagnado_final`)
   - Atualiza `lead_status` e `updated_at = now()`
   - Busca regra em `cs_automation_rules` onde `trigger_event` = etapa atual
   - Se existe template ManyChat, envia mensagem
   - Registra em `message_logs`

### 4. Kanban -- secao visual dos funis

**Arquivo: `src/components/SmartOpsKanban.tsx`**

Abaixo do Kanban principal, adicionar:

- Titulo "Leads Estagnados - Funis de Reativacao" com separador
- 3 blocos (EST1, EST2, EST3), cada um com 6 colunas horizontais
- Status keys: `est1_0` a `est1_5`, `est2_0` a `est2_5`, `est3_0` a `est3_5` (18 novos)
- Labels por coluna: "0d", "T+5", "T+10", "T+15", "T+20", "T+25"
- Cores: EST1 = tons rose, EST2 = tons slate, EST3 = tons amber
- Cada card mostra dias desde `updated_at` para indicar tempo na etapa
- Drag-and-drop funcional entre etapas
- Coluna extra `estagnado_final` ao final com leads que completaram o ciclo
- Query expandida para incluir os 25 status (7 pipeline + 18 est + estagnado_final)

---

## Resumo de arquivos

| Arquivo | Acao |
|---|---|
| `supabase/functions/smart-ops-piperun-webhook/index.ts` | Editar -- detectar "Estagnado" e iniciar/parar funil |
| `supabase/functions/smart-ops-sync-piperun/index.ts` | Editar -- mesma logica de deteccao para sync periodico |
| `supabase/functions/smart-ops-stagnant-processor/index.ts` | Criar -- avanco automatico a cada 5 dias + envio ManyChat |
| `src/components/SmartOpsKanban.tsx` | Editar -- secao visual dos 3 funis com drag-and-drop |

Nenhuma migration necessaria -- `lead_status` e TEXT livre e `cs_automation_rules` ja suporta regras por etapa.

