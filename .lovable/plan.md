## Problema

Hoje, ao editar uma campanha já ativa/finalizada e adicionar novos nós:

1. A UI exige nova **data de início futura** (`computeStartedAt` valida `> Date.now()`).
2. O `wa-campaign-builder` apaga todos os `pending` e **recria a fila do índice 0**, ancorada em `started_at`. Como as linhas `sent` permanecem, os nós já enviados ganham linhas duplicadas (`sent` antiga + `pending` nova) e seriam reenviadas.

O comportamento esperado: ao adicionar nós no fim do fluxo, o sistema deve **manter o que já foi enviado**, **não pedir nova data**, e **agendar apenas os novos nós** seguindo a sequência de `wait` a partir do último ponto.

## Fix (frontend + edge function, escopo cirúrgico)

### 1. `WaGroupFlowBuilder.tsx` — não exigir nova data ao editar campanha já iniciada

No carregamento (`useEffect` em `campaignId`), detectar se a campanha já foi iniciada (`started_at` no passado OU status ∈ `active|paused|finished|error`) e marcar um flag `isIncrementalEdit`.

No `handleSave`:
- Se `isIncrementalEdit`: **não** enviar `started_at` no payload, **não** rodar `computeStartedAt`, manter `status = 'draft'` apenas para destravar o builder.
- O `scheduleEnabled`/`scheduleDate` na UI só aparece para campanhas novas ou que ainda não dispararam.

### 2. `wa-campaign-builder/index.ts` — modo incremental

Detectar incremental quando já existem linhas em `wa_message_queue` para o `campaign_id` com status `sent` ou `sending`:

```text
Para cada grupo alvo:
  1. Buscar índices já enviados/em envio: SELECT node_index FROM wa_message_queue
     WHERE campaign_id=$1 AND group_jid=$2 AND status IN ('sent','sending')
  2. Buscar maior scheduled_at já existente (sent OR pending) → anchorTs
     (fallback: now() + 15s)
  3. Apagar APENAS pending desse grupo (já é o caso)
  4. Iterar flow_json:
       - Se node_index ∈ enviados → skip (não re-enfileira, mas continua acumulando waits posteriores)
       - Se é wait → acumula accMs (como hoje)
       - Senão → ts = anchorTs + accMs (ou regra spDateTimeToUtc para waits só-em-dias),
                 insere pending com node_index original
```

Resultado:
- Nós já enviados não são tocados (linha `sent` preservada, sem `pending` duplicada).
- Novos nós após o último wait são agendados a partir do âncora.
- Funciona também para campanha `finished`: novos nós voltam a campanha para `active` com `next_send_at` no primeiro pending novo.

### 3. Ajuste UI menor

Esconder/desabilitar o bloco "Agendar início" quando `isIncrementalEdit` e mostrar uma nota: *"Edição incremental — novos nós serão enfileirados após o último envio. Nós já enviados não serão reenviados."*

## Arquivos afetados

- `src/components/smartops/wa-groups/WaGroupFlowBuilder.tsx` (flag `isIncrementalEdit`, branch no save, UI do agendador)
- `supabase/functions/wa-campaign-builder/index.ts` (lógica incremental por grupo)

## Fora de escopo

- Reordenação/edição de nós já enviados (mantém intocado — quem edita um nó já enviado não vê efeito retroativo).
- Mudança no schema de `wa_message_queue`.
