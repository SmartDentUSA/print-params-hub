

# Plano: Preservar dados históricos no sync do PipeRun

## Problema

Quando o sync cria um novo lead no banco (linha 219-228 do `smart-ops-sync-piperun`), ele insere com:
- `source: "piperun_sync"` — sobrescreve a origem real
- `origem_campanha: origin_id` como número (ex: "245982") em vez do nome da campanha
- `total_messages: 0`, `total_sessions: 0` — zera contadores
- `created_at: now()` — perde a data real de criação no PipeRun

O `mapDealToAttendance` já extrai `deal.created_at` → `data_primeiro_contato`, mas não seta `piperun_created_at`. E o `origem_campanha` usa `deal.origin?.name` que funciona no webhook (com expand), mas no sync batch o `origin` vem apenas como ID.

## Correções

### 1. `piperun-field-map.ts` — `mapDealToAttendance`
- Adicionar `piperun_created_at: deal.created_at` ao mapeamento
- Adicionar `piperun_pipeline_id`, `piperun_stage_id`, `piperun_pipeline_name`, `piperun_stage_name`, `piperun_status`, `piperun_origin_id` para preservar metadados do PipeRun

### 2. `smart-ops-sync-piperun/index.ts` — Insert de novos leads
Na criação de novos leads (linha 219-228):
- Usar `source: "piperun"` em vez de `"piperun_sync"` (mais limpo)
- Setar `piperun_created_at: deal.created_at` explicitamente
- Resolver `origem_campanha` via API do PipeRun: buscar `origin.name` quando só temos o `origin_id` (ou manter um cache local de origins)
- Não zerar `total_messages`/`total_sessions` — estes campos já têm default 0 na tabela, está correto para leads novos vindos do PipeRun

### 3. `smart-ops-sync-piperun/index.ts` — Resolver origin names
O sync batch usa `"with[]": "person"` mas não inclui `"with[]": "origin"`. Adicionar `"with[]": "origin"` como segundo parâmetro na query de deals para que `deal.origin.name` venha preenchido em vez de apenas o `origin_id`.

### 4. `KanbanLeadDetail.tsx` — Melhorar exibição
- Renomear "Source" para "Origem" e mostrar valor mais amigável
- Mostrar `piperun_pipeline_name` e `piperun_stage_name` se disponíveis
- "Campanha" deve mostrar o nome real da origin, não o ID numérico

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/_shared/piperun-field-map.ts` | Adicionar `piperun_created_at`, `piperun_pipeline_id/name`, `piperun_stage_id/name`, `piperun_status` ao mapeamento |
| `supabase/functions/smart-ops-sync-piperun/index.ts` | Incluir `"with[]": "origin"` na API call; usar `source: "piperun"`; setar `piperun_created_at` no insert |
| `src/components/smartops/KanbanLeadDetail.tsx` | Exibir pipeline/stage names do PipeRun; renomear "Source" para "Origem" |

