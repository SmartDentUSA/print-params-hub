---
name: Intent Matching — No Cross-Stage Substitution
description: resolveIntent usa scoring com brand/model guards; combo.mesma_celula contém SOMENTE o produto pedido; LLM proibido de sugerir substituto da mesma etapa
type: feature
---

**Arquivo**: `supabase/functions/_shared/workflow-diagnosis.ts`

## Regras duras

1. **NUNCA cruzar marcas conhecidas**: se intent declara marca (BLZ, MEDIT, Rayshape, exocad, Phrozen, Anycubic, Elegoo, Formlabs, Asiga, SprintRay, Creality, 3Shape, NextDent, Detax, Ackuretta, Whip) e o produto candidato declara outra marca → skip imediato. Sem brand-crossover.

2. **NUNCA citar outro produto da mesma etapa como alternativa**: `combo.mesma_celula` contém SOMENTE `intent.matched_product_label` quando há match. Sem match → array vazio (vendedor qualifica antes). Acessórios/upgrades vêm apenas de `celula_adjacente` (etapa seguinte).

3. **LLM positioning prompt (`generatePositioningScript`)**: proibido sugerir alternativa/upgrade/substituto da mesma etapa; proibido tratar marca pedida como "concorrente"; obrigatório incluir 1 pergunta consultiva de descoberta.

## Scoring do `resolveIntent`

- Tokenização normaliza dígitos colados: `ino110` → `ino 110`, `i500` → `i 500`.
- Stopwords (categoria, não produto) ignoradas: `scanner`, `intraoral`, `bancada`, `impressora`, `resina`, `software`, `cad`, `curso`, `dispositivo`, `crédito`, `plus`, `wireless`, `mini`, `pro`, `max`, `ultra`, `edge`, `kit`, `combo`, `notebook`, `leads`, `face`, `smart`, `dent`, `dental`, conectores PT-BR.
- Pesos: brand token = 5, model number (tem dígito) = 4, outras = 1. Substring exato bidirecional = +6.
- Threshold de aceite: brand-match obrigatório quando intent tem marca; model-match OR brand-match quando intent tem número; score ≥ 6 no caso geral.

## Por que importa

Antes da v2, o matcher quebrava no primeiro token ≥ 4 chars compartilhado. "Scanner intraoral BLZ INO 100 Plus" matchava "Scanner Intraoral MEDIT i500" pelo token `scanner`. "Rayshape Edge Mini" matchava "Asiga Ultra" pelo token `impressora`. O briefing ao vendedor sugeria substituir o produto pedido por outro do portfólio — comportamento inaceitável.

## Validação

- `lucasvpb.odontologia@gmail.com` (pediu BLZ INO 100 Plus) → match correto, sem MEDIT.
- `pauloalvesguariroba@gmail.com` (pediu Rayshape Edge Mini) → match correto, sem Asiga.
- Preview: `smart-ops-preview-seller-note?email=...`.

## Fora de escopo

- `workflow_cell_mappings` está correto (produtos cadastrados); a correção é só no matcher.
- `behavioral-form-ingestion` (keywords → `produto_interesse_auto`) é camada separada, não foi alterada.