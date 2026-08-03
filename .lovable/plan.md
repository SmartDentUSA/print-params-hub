# Fase A — Auditoria de identidade (somente leitura) e plano de reparação

Status: nenhuma alteração aplicada. Os números abaixo foram confirmados agora, em produção, com queries somente leitura sobre o dataset completo (não amostra).

## 1. Confirmação dos achados

### Achado 1 — `lia_attendances.merged_into` corrompido (CONFIRMADO)

| Métrica | Valor confirmado agora |
|---|---|
| Registros com `merged_into` | 1.025 |
| Self-merge (`merged_into = id`) | 158 (15,4%) |
| Cadeias (A→B, B→C) | 16 |
| Alvos inexistentes / ciclos | 0 |
| Destinos distintos (não-self) | 687 → 657 com 1 origem, 23 com 2, 7 com >2 |
| Maior mega-bucket | 87 origens → `887e09fc…` ("Junior", DENTAL PROGRESSO) |

Classificação de risco dos 867 merges não-self:

| Classe | Qtd |
|---|---|
| confirmed_wrong — CNPJ divergente (ambos preenchidos) | 122 |
| confirmed_wrong — CPF divergente | 11 |
| high_risk — pessoa física fundida com empresa | 184 |
| high_risk — evidência fraca (sem documento, sem telefone igual) | 68 |
| ambiguous — só telefone igual, nome divergente | 217 |
| likely_valid — telefone igual + nome ≥0,75 de similaridade | 246 |
| confirmed_valid — mesmo CNPJ / mesmo CPF | 19 |

Impacto material confirmado: 304 notas fiscais casam por CNPJ e 90 por CPF em leads já fundidos; 537 leads fundidos possuem deals no espelho local; 5 matrículas de treinamento estão penduradas em leads fundidos.

Caso sentinela reproduzido: `8ef257c2…` (MARCIA VERALDI, CNPJ 45.780.540/0001-73) tem `merged_into = 887e09fc…` (Junior, CNPJ 09.412.931/0001-71, CPF 101.042.064-03), com `merge_history.reason = "email_conflict"`. LTV do destino: R$ 2.509.145,17. Existe ainda um terceiro registro da mesma empresa (`e38eec4b…`, deal 51909112, LTV R$ 79.500) não fundido — além da fusão errada há fragmentação do cliente legítimo.

### Rotas responsáveis (origem do estrago)

- Trigger SQL `public.auto_dedup_by_phone` — funde por telefone quando (a) nomes normalizados iguais, **ou (b) e-mail contém `placeholder`/`import_`, ou (c) apenas o primeiro token do nome bate com ≥4 caracteres**. As cláusulas (b) e (c) explicam o bucket "Junior" (87 origens) e a maioria dos 447 merges por telefone. Reasons gravados: `auto_phone_dedup_trigger` (230) e `phone_dedup` (430).
- `resolveDuplicateEmailConflict` em `supabase/functions/smart-ops-sync-piperun/index.ts` e `supabase/functions/piperun-full-sync/index.ts` — em colisão de e-mail (inclusive e-mails sintéticos `deal-*@import.placeholder`) funde no primeiro lead achado por e-mail. Reason `email_conflict` (173 linhas) — foi essa rota que fundiu Marcia em Junior.
- `manychat-lia-bridge` — `mergeIntoCanonical` por e-mail/telefone.
- Leitura: `_shared/assert-canonical-lead.ts` segue apenas 1 salto (não resolve as 16 cadeias); `smart-ops-lia-assign` segue `merged_into` sem detecção de ciclo; painel/LTV agregam `piperun_deals_history` do sobrevivente — é ali que a contaminação financeira vive (trigger `fn_recalc_ltv_from_deals` soma o histórico inteiro).
- Self-merges (158) não têm rota atual de escrita — provável backfill antigo; os guards `fn_guard_lia_no_self_merge` / `fn_guard_lia_flatten_merge` existem, mas as linhas antigas permaneceram.

### Achado 2 — documento é o vínculo mais confiável (CONFIRMADO)
4.008 notas com documento preenchido; 1.538 casam por CNPJ contra `lia_attendances`; `lead_id` preenchido em apenas 2.341 notas (58,4%). Conclusão mantida: reconciliação financeira deve usar documento normalizado como chave primária e os campos de ID apenas como reforço.

### Achado 3 — NFe do Drive x `omie_notas_fiscais` (não reconfirmável em modo leitura)
Depende de paginar a pasta "# - Nfe" no Drive; nada foi executado. Fica como tarefa da Fase A2.

### Achado 4 — CS Onboarding CRM → `deals` (parcial)
Espelho local tem 7.694 deals ativos de CS Onboarding. Reconfirmar os 118 IDs faltantes exige leitura da API do PipeRun com a mesma janela (março–agosto/2026) — Fase A2, somente leitura.

### Achado 5 — contrato D4Sign ↔ deal
Sem FK; o único vínculo é texto livre no nome do arquivo. Correção é de fluxo de criação do envelope, não de dado.

## 2. Fase A2 (ainda somente leitura)

1. `fn_identity_merge_audit()` — função somente leitura devolvendo, por par: source_id, target_id, cadeia resolvida, CNPJ/CPF normalizados, telefone E.164, e-mails, IDs PipeRun, nomes/empresas, evidências, conflitos, regra e data do merge, nº de deals, valor em NF, nº de treinamentos, classe de risco e justificativa.
2. Exports CSV em `/mnt/documents`: merges classificados, self-merges, cadeias, mega-buckets, CNPJs com mais de um `company_id`, chaves NFe faltantes por competência, IDs de deal CS Onboarding faltantes.
3. Documentação de escopo de cada export (arquivo, hash, período, timezone, filtro) antes de qualquer comparação de integridade referencial.

## 3. Fase B — regra nova (só após aprovação)

- Entidades canônicas separadas: pessoa física, empresa/unidade fiscal, relacionamento pessoa–empresa, deal, participantes do deal.
- Níveis: `deterministic_auto` (documento válido igual, sem conflito) → `high_confidence_candidate` → `low_confidence_candidate` → `blocked_conflict` → `no_match`.
- B2B: CNPJ válido igual pode unificar; CNPJ válido diferente bloqueia; matriz e filial permanecem distintas. B2C: CPF igual pode unificar; CPF diferente bloqueia. Nunca fundir pessoa com empresa. Telefone, e-mail e nome nunca autorizam sozinhos.
- Patch em `auto_dedup_by_phone` (remover as cláusulas de placeholder e de primeiro-token), em `resolveDuplicateEmailConflict` das duas funções de sync (ignorar e-mails sintéticos e exigir documento) e em `manychat-lia-bridge`.
- Tabela `identity_merge_reviews`: survivor canonical id, source record id, regra, versão da regra, confiança, evidências, conflitos, status, criado_em, aprovado_por, aprovado_em, justificativa, snapshot anterior, revertido_em, revertido_por, motivo da reversão, idempotency_key. Baixa confiança entra na fila e nunca aplica.
- Resolução de `merged_into` passa a seguir a cadeia com detecção de ciclo (helper compartilhado + RPC).

## 4. Fase C/D — reparação (somente após aprovação do relatório)

- Nenhum `deal_id`, `training_id`, `piperun_person_id` ou `piperun_company_id` alterado; o treinamento continua ancorado no `deal_id` de origem, corrigindo apenas o participante pessoa/empresa canônico.
- Reversão dos `confirmed_wrong` e `high_risk`: limpar `merged_into`, devolver deals/matrículas ao lado correto e remover do sobrevivente as oportunidades que não são dele (descontamina `piperun_deals_history`, LTV recalcula pelo trigger).
- Dry-run obrigatório com antes/depois, backup lógico, lotes pequenos, log por operação, rollback por operação e parada automática se os totais divergirem além do limite aprovado.

## 5. Esforço e causa raiz provável

| Achado | Causa raiz mais provável | Esforço |
|---|---|---|
| 1 — merges errados | fallback por nome/placeholder no trigger de telefone + merge por colisão de e-mail sintético | Alto (patch de regra + fila + reversão de ~385 pares + descontaminação de LTV) |
| 2 — chave de reconciliação | IDs preenchidos de forma incompleta pelos syncs | Baixo (padronizar consultas por documento) |
| 3 — NFe abril/2025 | janela de datas do sync original não cobriu o mês | Médio (varredura do Drive + backfill por chave) |
| 4 — CS Onboarding março/2026 | falha ou filtro temporário no job de sync | Médio (repuxar 118 IDs via API) |
| 5 — D4Sign sem FK | vínculo apenas no nome do arquivo | Médio (deal_id nos metadados do envelope + webhook) |

## 6. Critérios de aceite (Fase D)

Caso Marcia reproduzido antes e corrigido depois; zero `deal_id`/`training_id` alterado; zero deal duplicado na agregação; totais reconciliados por fonte e período equivalentes; zero merge automático por telefone, e-mail ou nome isolados; zero merge automático com documento conflitante; 100% das operações com evidência, ator, regra e rollback; testes cobrindo B2B, B2C, pessoa–empresa, telefone compartilhado, matriz/filial, cadeias, ciclos e reprocessamento idempotente.