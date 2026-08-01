# Desligamento do `smart-ops-kanban-move`

A auditoria da semana (25/07 → 01/08) não encontrou nenhuma execução da função: zero registros em `system_health_logs` e todas as 50.202 transições em `piperun_stage_transitions` com `source = auto_trigger` (leitura do webhook). Os três chamadores existentes estão mortos, quebrados ou fora da Golden Rule.

## Situação dos chamadores

| Chamador | Estado | Ação |
|---|---|---|
| `src/components/SmartOpsKanban.tsx` | `SmartOpsKanban` é exportado mas não é importado em nenhum lugar de `src/` — código morto | Remover o bloco de invoke (e o estado `movingToPiperun` que só existe para ele) |
| `src/hooks/useEnrollment.ts` (linha 129) | Envia `{ deal_id, target_stage, pipeline_id, check_golden_rule }`; a função só aceita `{ piperun_id, new_status }` → falha silenciosa em `.catch(console.warn)` desde sempre | Remover a chamada; a matrícula deixa de tentar mover o card |
| `smart-ops-copilot` → tool `move_crm_stage` | Funciona, mas faz PUT direto de `stage_id`+`pipeline_id` sem guard de Golden Rule e escreve em `etapa_crm` (coluna inexistente) | Remover a tool do schema e o executor |

## Passos

1. **`useEnrollment.ts`** — apagar o passo 4 (invoke do kanban-move). Nada mais no hook depende dele; o log `treinamento_agendado` e o writeback continuam.
2. **`SmartOpsKanban.tsx`** — remover a invoke e a UI de "sincronizando PipeRun". O drag-drop continua atualizando `lead_status` local (comportamento atual, componente não renderizado).
3. **`smart-ops-copilot/index.ts`** — remover a entrada `move_crm_stage` do array de tools, o `case` no dispatcher e a função `executeMoveCrmStage`. Isso também elimina 3 das referências a `etapa_crm`. Deploy só via Lovable/CLI (arquivo ~170 KB), nunca por MCP.
4. **Função** — manter `supabase/functions/smart-ops-kanban-move/` e a entrada em `supabase/config.toml` no lugar por ora, sem chamadores. Sem deleção nesta etapa: se aparecer necessidade de move manual, a função volta a ser usada com guard próprio.

## Consequência operacional

Depois disso, nenhuma automação move card no PipeRun exceto:
- `smart-ops-lia-assign`, apenas na criação do deal ou na reativação Estagnados → Vendas;
- `smart-ops-stagnant-processor`, restrito ao funil Estagnados e com cron desativado.

Movimentação de etapa em Vendas passa a ser 100% manual na UI do PipeRun, e o `smart-ops-piperun-webhook` continua espelhando as mudanças para `piperun_stage_name` / timeline.

## Detalhes técnicos

- Nenhuma migration; nenhuma mudança de schema.
- A correção completa de `etapa_crm` no Copilot (≈15 pontos de leitura) fica no plano separado já aprovado; aqui só saem as referências dentro de `move_crm_stage`.
- Rollback: redeploy da versão anterior do Copilot e revert dos dois arquivos de frontend.
