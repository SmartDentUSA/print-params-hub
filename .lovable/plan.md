## Objetivo
Reprocessar os 31 leads do CSV que não foram encontrados nem por e-mail nem por telefone em `lia_attendances`/`piperun_persons_mirror`, usando `smart-ops-meta-lead-ads-pull` com lookback estendido e, em seguida, `smart-ops-lia-assign` cirúrgico para os que ainda ficarem órfãos.

## Passos

1. **Snapshot da lista dos 31 faltantes**
   - Query em `lia_attendances` + `piperun_persons_mirror` filtrando pelos e-mails do CSV.
   - Persistir os 31 registros em `system_health_logs` como `csv_reconciliation_missing` (lead_email, form_name, csv_row, batch_id).
   - Gerar `batch_id` único para rastrear o lote.

2. **Reprocessamento via `smart-ops-meta-lead-ads-pull`**
   - Invocar a função com `sinceMinutes` estendido cobrindo o range das datas dos 31 (lookback adaptativo já implementado).
   - Passar `force_reprocess=true` e `email_whitelist=[...31 emails]` para evitar reprocessar toda a janela.
   - Respeitar o Commercial Intent Guard e a normalização Zernio existente (área, produto_interesse, equipamentos).

3. **Fallback cirúrgico via `smart-ops-lia-assign`**
   - Para os leads que continuarem sem `piperun_person_id` após o pull (ex.: e-mails ausentes na Meta API por retenção), chamar `smart-ops-lia-assign` diretamente com o payload reconstruído a partir da linha do CSV (nome, e-mail, telefone se houver, form_name, produto_interesse).
   - Aplicar Golden Rule (não tocar CS/Vendas existentes, criar novo Deal em Vendas se necessário).

4. **Auditoria final**
   - Rodar a mesma query do passo 1 e comparar antes/depois.
   - Marcar em `system_health_logs` cada e-mail como `reconciled_via_meta_pull`, `reconciled_via_lia_assign` ou `still_missing` (com motivo).
   - Retornar sumário: quantos entraram por qual caminho e quais permanecem sem match (com hipótese: sem telefone + fora da janela de retenção da Meta).

## Fora de escopo
- Não alterar `piperun-field-map.ts`, `equipment-field-guard.ts` nem qualquer lógica de ingestão.
- Não mexer em CS Onboarding nem em deals existentes.
- Não gerar CSV nesta rodada (já foi oferecido; usuário optou pelo reprocessamento direto).

## Detalhes técnicos
- Funções: `smart-ops-meta-lead-ads-pull`, `smart-ops-lia-assign`.
- Tabelas de leitura: `lia_attendances` (com `merged_into IS NULL`), `piperun_persons_mirror`.
- Tabela de escrita (auditoria apenas): `system_health_logs`.
- Chunking: lotes de ≤10 e-mails por chamada ao pull para evitar timeout.
