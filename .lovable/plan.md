# Corrigir `etapa_crm` inexistente no Copilot

`lia_attendances.etapa_crm` não existe no banco. As referências no Copilot causam erro `column does not exist` em selects, filtros e no update de etapa. A coluna real do funil CRM é **`piperun_stage_name`** (31.714 de 32.746 leads canônicos preenchidos, sincronizada do PipeRun junto com `piperun_stage_id` e `piperun_stage_changed_at`).

## Deploy 1 — somente leitura

Em `supabase/functions/smart-ops-copilot/index.ts`, trocar `etapa_crm` por `piperun_stage_name` em todos os pontos de leitura:

- selects padrão de leads (linhas ~1106, 1157, 1845, 1898, 2117, 2127)
- allowlist de campos e colunas expostas ao LLM (~1130, 1809, 2196)
- agregação por etapa (~1826-1828)
- checagem de campo faltante no diagnóstico (~2225)
- descrições dos schemas de tools (~207, 208, 254) passam a citar `piperun_stage_name`

Mesma troca no ponto equivalente de `smart-ops-piperun-webhook/index.ts` (~1676, 1687), que também lê `etapa_crm` no check de completude.

Nesta fase a tool `move_lead_stage` continua movendo o deal no PipeRun via `smart-ops-kanban-move`, mas **não escreve** a etapa local: o update local é removido e a resposta informa que a etapa local será atualizada pelo webhook do PipeRun. Assim nenhuma escrita nova entra em campo de funil antes da validação.

Validar depois do deploy: pedir ao Copilot contagem de leads por etapa e comparar com os números do time comercial; conferir que `etapa_crm does not exist` desaparece dos logs por 24 h.

## Deploy 2 — liberar escrita (após validação)

Reativar em `move_lead_stage` a escrita local de `piperun_stage_name` + `piperun_stage_id` + `piperun_stage_changed_at`, mantendo o move no PipeRun como fonte da verdade.

## Detalhes técnicos

- `src/integrations/supabase/types.ts` é gerado pela API do Supabase; como não há mudança de schema, ele não é editado à mão. A declaração de `etapa_crm` nele é resíduo e será corrigida na próxima regeneração automática.
- As migrations `20260722175031_…` e `20260728223606_…` citam `etapa_crm` apenas dentro da allowlist de campos da função `smart_ops_field_normalize_distinct` — não houve rename de coluna; o campo simplesmente nunca existiu. Ajuste dessa allowlist fica fora deste escopo (a função rejeita o campo com erro explícito, sem risco de dado corrompido).
- `smart-ops-copilot/index.ts` tem ~170 KB: deploy apenas via Lovable/CLI, nunca por MCP `deploy_edge_function`.
- Rollback: redeploy da versão anterior da Edge Function.