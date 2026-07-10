---
name: Estagnados Redelivery Reactivation Escape Hatch
description: Meta re-delivery com novo leadgen_id em lead cujo canonical está em Funil Estagnados (72938) dispara reactivation via lia-assign; Vendas (18784) e CS (83896/102893) permanecem intocáveis
type: feature
---

Regra: se um lead preenche um NOVO formulário (novo `platform_lead_id` / `leadgen_id`) E o canonical está em `piperun_pipeline_id = 72938` (Funil Estagnados), `smart-ops-ingest-lead` sai do modo CDP-only e invoca `smart-ops-lia-assign` com:

- `trigger: "sdr_captacao_reativacao"`
- `new_conversion_confirmed: true`
- `conversion_key: <buildConversionKey>`
- `force: true`

`lia-assign` re-consulta os deals reais no PipeRun e:
- Preserva qualquer deal aberto em Vendas (18784) — Golden Rule.
- Nunca toca deals em CS (83896, 102893, 104500) nem deals ganhos.
- Fecha o deal Estagnados como "Perdido — Novo interesse" e cria novo em Vendas com round-robin (novo vendedor).
- Se houver intervenção manual do vendedor no deal Estagnados, preserva e registra skip.

Todos os outros pipelines (CS, Ganhos, Treinamento, E-book, Distribuidor) mantêm o comportamento CDP-only na re-entrega Meta.

**Why:** Renan Balsanelli (deal 46234182) preencheu novo formulário mas caiu em CDP-only porque o guard `existing_lead_no_new_conversion_cdp_only` no lia-assign bloqueava sem `new_conversion_confirmed=true`, e o ingest curto-circuitava o redelivery antes de sinalizar nova conversão.

**Cobertura em ambas as rotas de dedupe (crítico):** o escape hatch está implementado em DOIS blocos de `smart-ops-ingest-lead/index.ts` porque o ingest tem duas rotas de dedupe distintas:

1. **Rota A — early dedupe (`deferredRedeliveryCanonicalId`)**: dispara quando `platform_lead_id`/leadgen bate na dedupe universal (hard/family). Bloco no ~L641.
2. **Rota B — enrichment merge (`lead_enrichment_merge`)**: dispara quando o lead é encontrado por identity match (email/telefone) mais tarde no fluxo, especialmente quando o email da nova submissão difere do canônico. Bloco após o update de merge (~L1375).

Se adicionar novos pipelines reativáveis, atualizar `canonPipelineId === 72938` para `[72938, <novo_id>].includes(...)` nos DOIS blocos. Sem espelhar na rota B, leads em Estagnados que preenchem novo lead ad ficam presos em CDP-only (caso Marcelo Correa / Renan Balsanelli 10/07/2026).

**How to apply:** Ao adicionar novos pipelines "reativáveis", estender o check nos dois blocos acima.