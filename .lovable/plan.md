## Objetivo
Verificar se os custom fields do PipeRun estão realmente preenchidos nos deals criados a partir da integração Loja Integrada (Sob Consulta) e corrigir/backfillar o que faltar.

## Diagnóstico já levantado

- 228 leads com `source='loja_integrada'` + `piperun_id` preenchido + `produto_interesse` populado.
- Todos os 228 estão com `lia_attendances.piperun_custom_fields = []` (mirror vazio).
- Código do `smart-ops-lia-assign` mapeia corretamente `produto_interesse` → CF `549058` e `produto_interesse_auto` → CF `549148` via `mapAttendanceToDealCustomFields` (`_shared/piperun-field-map.ts:1241,1272`) antes de todo `createNewDeal`/`updateExistingDeal`.
- Mirror vazio pode significar duas coisas:
  1. Os CF nunca foram enviados ao PipeRun (bug no fluxo e-commerce), OU
  2. Os CF foram enviados, mas o `piperun-webhook`/`mapDealToAttendance` (`piperun-field-map.ts:818`) sobrescreveu depois com `cf || []` ao ler o deal de volta sem custom fields no payload.

Precisamos confirmar contra o PipeRun ao vivo antes de agir.

## Passos

### 1. Auditoria ao vivo (read-only)
Amostrar 5 deals recentes da Loja Integrada e chamar `GET /deals/{id}` no PipeRun via `piperun-diagnostics` (ou edge equivalente já existente) para inspecionar `custom_fields`. Alvos:
- 62103010 · Laiz Figueiredo · Scanner MEDIT i900
- 62067016 · Yasmin · Fresadora Arum 5X
- 62058725 · Jonatan · DentalCAD
- 62055131 · Tomaz · Pionext UV-02
- 62040816 · Letícia · MEDIT i900

Resultado esperado por deal: pelo menos CF 549058 (Produto de interesse) e 549148 (auto) preenchidos com o nome do produto.

### 2. Diagnóstico condicional
- **Se os CF estão presentes no PipeRun** → o problema é só o mirror sendo zerado pelo webhook readback. Ajustar `mapDealToAttendance` para NÃO sobrescrever `piperun_custom_fields` quando o payload de leitura vier sem `custom_fields` (preserva a última escrita local).
- **Se os CF estão ausentes no PipeRun** → o fluxo de e-commerce está criando o deal antes do `produto_interesse` estar disponível OU está usando um branch de `createNewDeal` que ignora `customFields`. Traçar o `flowType` real de um `produto_sob_consulta` recente via `system_health_logs` e corrigir a ordem (ingest grava `produto_interesse` → aguardar → invocar `lia-assign`).

### 3. Backfill dos 228 deals
Após identificar a raiz, rodar backfill que, para cada lead loja_integrada com `piperun_id` e `produto_interesse` não-nulo:
- Chama `updateExistingDeal` (via `smart-ops-lia-assign` com `force: true` + `new_conversion_confirmed: true` OU um endpoint dedicado tipo `smart-ops-piperun-cf-backfill`) enviando somente CF 549058 e 549148.
- Preserva `piperun_id`, `owner_id`, pipeline, stage — só reescreve custom fields.
- Loga em `system_health_logs` com `error_type='piperun_cf_backfill_ecommerce'`.

### 4. Verificação pós-fix
- Rodar novamente a auditoria dos 5 deals-amostra + spot-check no CRM UI.
- Confirmar que novos leads Loja Integrada nascem com CF preenchido (monitorar próximas 24h).

## Fora do escopo
- Área de atuação, especialidade, tem_scanner, tem_impressora — o formulário "Produto Sob Consulta" da Loja Integrada NÃO coleta esses campos; permanecerão vazios no deal (esperado). Só o "Produto de interesse" é obrigatório para essa origem.

## Detalhes técnicos
- Custom field IDs: `PRODUTO_INTERESSE=549058`, `PRODUTO_INTERESSE_AUTO=549148` (`_shared/piperun-field-map.ts:215-219`).
- Snapshot local escrito em `updateExistingDeal` só quando `cfPayload.length > 0` (`smart-ops-lia-assign/index.ts:838-848`) e em `createNewDeal` (linhas 945-957) — se cfPayload vier vazio nunca escreve, o que explicaria mirror `[]` para deals criados sem CF.
- Suspeita reforçada: `mapDealToAttendance` (`piperun-field-map.ts:818`) usa `cf || []` sobre `piperun_custom_fields`, então qualquer webhook subsequente sem custom_fields limpa o mirror local.