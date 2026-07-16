## Ação

Reprocessar 3 dos 4 leads via edge function `lia-assign` com `commercial_override=true`. Skip do #1 (email de teste, bloqueado por regra).

| # | attendance_id | Lead | Ação |
|---|---|---|---|
| 1 | 02efa7dc-1f23-4a27-bd27-f4f20e181a96 | julesteste (teste) | **skip** (crm_creation_blocked=true) |
| 2 | 08f36444-c228-408e-aede-15067daad98b | Dra. Paulina Becker | reprocessar |
| 3 | f0e34a3d-1f9c-46f5-add9-38ed5ec593df | Rafael Mensch Tavares | reprocessar |
| 4 | 67d289e8-d017-4c6f-abd6-24375ab2465e | Instituto Excellence | corrigir email `.nf → .br` e reprocessar |

## Passos

1. `UPDATE lia_attendances SET email='richard.valdomiro@terra.com.br' WHERE id='67d289e8-…'` (typo óbvio no TLD).
2. Chamar `lia-assign` 3× (uma por attendance_id) com `{ attendance_id, commercial_override: true, source: 'manual_reprocess_julho_2026' }`.
3. Validar via `SELECT id, piperun_id, piperun_deal_id, piperun_pipeline_name FROM lia_attendances WHERE id IN (…)`.
4. Ler `system_health_logs` e `agent_actions_log` para os 3 IDs no intervalo 04-05/07 e reportar por que a criação original falhou silenciosamente.
5. Reportar resultado consolidado (deals criados + causa raiz identificada).

## Não incluso
- Correção estrutural do fluxo silencioso (fica para plano separado após diagnóstico).
- Métricas `fn_form_metrics` (plano anterior, ainda pendente).
