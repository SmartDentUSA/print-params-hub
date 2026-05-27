## Objetivo
Quando o dedupe `meta_form_history_12h` (4ª camada em `smart-ops-ingest-lead/index.ts:468-549`) identificar que o payload Meta é re-entrega de um lead canônico, **mesclar** os campos novos do payload antes do `return duplicate_skipped`, sem criar lead novo, sem reabrir PipeRun e sem disparar lia-assign.

Caso de validação: Itamar Cardoso — form `4309081142703799`, leadgen `1133775195620358`, telefone `+5574999368703`. Hoje cai no dedupe e perde `tem_impressora=sim`, `impressora_modelo=ANYCUBIC`, `como_digitaliza=Ainda não digitalizo`, `area_atuacao=Laboratório de Prótese`, e o email `itamaroc.lions@gmail.com` (canônico tem `@hotmail.com`).

## Único arquivo alterado
`supabase/functions/smart-ops-ingest-lead/index.ts` — bloco entre `if (priorForm) {` (linha ~486) e o `return` de `meta_form_history_12h` (~544).

## Política de merge (não-destrutiva)

**COALESCE-only** (só preenche se canônico está vazio/null/"não"):
- `area_atuacao`, `especialidade`, `como_digitaliza`
- `produto_interesse`, `produto_interesse_auto`, `resina_interesse`
- `telefone_normalized` (se ainda não existia)

**ALWAYS_UPDATE** (memory `form-enrichment-v3` — equipamentos podem evoluir):
- `tem_impressora`, `tem_scanner`, `impressora_modelo`
- Só sobrescreve quando incoming é não-vazio, diferente de "não" e diferente do atual.

**NUNCA tocar** (Person Origin Frozen + identidade canônica):
- `origin_id`, `origem_primeiro_contato`, `form_name`
- `email` canônico (preservado conforme `incomingEmailDiffersFromCanonical`)
- `nome`, `piperun_id`, `pessoa_piperun_id`, `status_oportunidade`, `proprietario`

**Catch-all `form_data` JSONB** (memory `lead-form-catch-all-jsonb`):
- Append entry `{ at, via, leadgen_id, form_id, incoming_email, fields_filled, payload_snapshot }` em `form_data.enrichment_history`
- Cap em 10 entradas (`.slice(-10)`) para não inflar a coluna.

## Side-effects controlados

1. **Update único**: tudo gravado no mesmo `.update(lia_attendances)` que já faz o backfill de `platform_lead_id`/`platform_form_id` — sem round-trip extra.

2. **`system_health_logs` `meta_form_history_dedupe`** ganha 3 campos novos:
   - `incremental_enrichment_applied: boolean`
   - `enriched_fields: string[]`
   - `incoming_email_differs: boolean`

3. **`lead_activity_log`** ganha entry **`form_enrichment`** (não `form_submission`!) só quando `enriched_fields.length > 0`. Crítico: `form_submission` reiniciaria a janela de 12h e criaria loop — evitamos isso usando event_type novo.

4. **Response JSON** ganha `incremental_enrichment: string[]` para auditoria do caller.

## O que NÃO muda
- Nenhuma migração SQL (todas as colunas usadas já existem).
- Nenhum trigger novo (`form_enrichment` é só uma string — não há listener que reaja a esse event_type, confirmado por `rg form_enrichment supabase/`).
- Camadas 1-3 de dedupe intactas.
- `lia-assign`, `deal-form-note`, `seller-summary`, `sellflux-sync` continuam **não sendo disparados** (return mantém `duplicate_skipped`).
- Person Origin Frozen respeitado.
- Sanitizer `PostgREST embed-update guard` não afetado: todos os valores escritos são escalares ou JSONB top-level.

## Validação pós-deploy
1. Re-disparar a mesma redelivery do Itamar (qualquer redelivery futura do leadgen `1133775195620358` serve) e conferir:
   - `lia_attendances.b60f2c18-94be-4dfc-a756-f37fb09f3366` agora tem `tem_impressora='sim'`, `impressora_modelo='ANYCUBIC'`, `como_digitaliza='Ainda não digitalizo'`.
   - `email` segue `@hotmail.com` (não foi sobrescrito).
   - `form_name` e `origem_primeiro_contato` inalterados.
   - `form_data.enrichment_history` tem entry com `incoming_email='itamaroc.lions@gmail.com'`.
2. `system_health_logs` mostra `incremental_enrichment_applied=true` e `enriched_fields` ≥ 3.
3. PipeRun do lead não ganhou Deal novo nem note nova.
4. SQL de auditoria 7d:
   ```sql
   SELECT
     count(*) filter (where (details->>'incremental_enrichment_applied')::bool) AS enriched,
     count(*) AS total
   FROM system_health_logs
   WHERE error_type='meta_form_history_dedupe' AND created_at > now() - interval '7 days';
   ```
   Esperado: `enriched > 0` (cobre tanto Itamar quanto qualquer canônico legado sem equipamento).

## Fora de escopo
- Backfill retroativo de redeliveries anteriores ao deploy (não há payload arquivado fora dos logs).
- Mexer no email canônico (`@hotmail.com` → `@gmail.com` exigiria política nova de "email mais recente vence" — fora do pedido).
- Disparar enrichment do briefing (`lia-assign`) para refletir os novos equipamentos — o próximo briefing natural já lerá os campos atualizados via `enrichLeadFromIdentity`.
- Alterar a janela de 12h ou as outras 3 camadas de dedupe.
