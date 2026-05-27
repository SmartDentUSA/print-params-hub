## Objetivo

A nota PipeRun e o briefing WhatsApp do vendedor passam a ter um **bloco de inteligência contextual** que cruza o que o lead **já tem** (equipamentos, software, especialidade) com o que ele **busca** (produto de interesse / formulário de entrada) usando o **Motor de Regras 7×3** (`workflow_cell_mappings` — products, sdr_fields, competitors por célula).

O output não é uma lista crua de produtos — é um **script de abordagem pronto** que diz ao vendedor:
1. **O que perguntar** sobre o setup atual do lead (para validar compatibilidade)
2. **Como conectar** o produto de interesse ao stack existente (benefício específico)
3. **O que oferecer junto** (cross-sell coerente com o fluxo digital dele)
4. **Como posicionar** contra o concorrente que ele já usa

### Exemplo do output esperado

Lead: CS 3600 (Carestream), implantodontista, impressora Anycubic, interesse declarado **GlazeON**.

```
🧭 Diagnóstico Fluxo Digital
Etapa atual do lead: 1→3 (digitaliza + imprime). Lacuna em 4 (pós) e 2 (CAD próprio?).
Concorrência detectada: Carestream CS 3600 (scanner), Anycubic (impressora desktop).

🎯 Intenção declarada: GlazeON  →  célula 4 / Limpeza & Acabamento (pós-impressão de splints/placas)

📋 Pergunte ao lead:
  1. Quantas placas/mês você imprime hoje? Qual resina (Bio Splint? concorrente)?
  2. Como faz o pós-cura e brilho hoje? Lixa manual? Verniz?
  3. Já testou ciclo completo Smart Print + GlazeON na Anycubic?
  4. Usa exocad/Blue Sky/3Shape no CAD? (não está claro no cadastro)

💡 Como posicionar GlazeON com o setup dele:
  • CS 3600 → exporta STL aberto, 100% compatível com nossas resinas Bio Splint.
  • Anycubic Mono → roda nossas resinas, mas perda de produtividade vs Rayshape
    (3× mais rápida, perfil validado). Use isso como gancho de upgrade futuro.
  • GlazeON entrega acabamento clínico em <2min sem polimento manual — ganho
    direto no tempo-cadeira do implantodontista.

🛒 Combo recomendado (mesma etapa + adjacentes):
  • Etapa 4: GlazeON Splint + Smart Cure XL
  • Etapa 3: Resina Bio Splint Clear (compatível Anycubic)
  • Etapa 6: Curso "Splints no Fluxo Digital" (alta conversão p/ implanto)

⚠️ Risco: lead já tem stack funcional → não empurrar Rayshape no 1º contato.
   Próxima etapa natural é Pós (GlazeON) e Resina nossa. Rayshape vira upsell em D+30.
```

## Como funciona (motor determinístico + 1 chamada LLM curta)

### Camada 1 — `_shared/workflow-diagnosis.ts` (determinístico)

Função `diagnoseLead(supabase, lead)` retorna:

```ts
{
  stack_atual: [
    { stage, cell, value, is_competitor, competitor_label }
  ],
  intent: {
    produto: "GlazeON",
    target_stage: "etapa_4_pos_impressao",
    target_cell: "limpeza_acabamento",
    source: "produto_interesse | form_name | sdr_*_interesse"
  },
  lacunas: [stage/cell sem dados que são pré-requisito da intent],
  combo_sugerido: {
    mesma_celula: [...top 3 produtos],
    celula_adjacente: [...top 2],
    cursos: [...top 1 se etapa 6 vazia]
  },
  perguntas_qualificacao: [...derivadas dos sdr_fields da intent + lacunas]
}
```

**Algoritmo:**
1. Carregar `workflow_cell_mappings` (cache em memória, ~150 linhas, 1 SELECT).
2. **Stack atual** — iterar células × `sdr_field`. Para cada campo do lead (`equip_*`, `software_cad`, `sdr_*_modelo`, `raw_payload.custom_fields`, último `smartops_form_field_responses` por field_name), checar se valor casa com a lista `competitor` da célula → flagar.
3. **Intent** — resolver alvo cruzando: `produto_interesse` / `form_name` / `sdr_*_interesse` / `last_form_submitted` contra `mapped_label` de `mapping_type='product'`. Match por substring case-insensitive + sinônimos curtos (glazeon→Smart Seal Glaze / GlazeON Splint).
4. **Lacunas** — pré-requisitos por etapa: alvo na etapa 4 exige presença em 3 (impressora) e 2 (CAD); alvo em 5 exige 4; etc. Tabela de pré-req hardcoded curta (7 entradas).
5. **Combo** — mesma célula (top 3 products), célula adjacente da próxima etapa (top 2), curso da etapa 6 se etapa 6 vazia.
6. **Perguntas** — para cada `sdr_field` da célula-alvo e das lacunas que está vazio no lead, gerar pergunta no template `"<label_humano>?"` (mapa label→pergunta curto, ~25 entradas).

Zero LLM até aqui. Tudo derivado de `workflow_cell_mappings` + `lia_attendances` + `smartops_form_field_responses`.

### Camada 2 — script de abordagem (1 chamada DeepSeek curta, ~600 tokens)

Apenas a parte **"Como posicionar X com o setup dele"** e o **"Risco / próxima etapa"** vão para DeepSeek com prompt **enxuto e fechado**:

```
Você é consultor técnico Smart Dent. Lead tem:
  Stack: <stack_atual JSON>
  Concorrentes detectados: <lista>
  Intent: <produto X — etapa Y/célula Z>
  Lacunas: <lista>
  Combo sugerido pelo motor: <lista fixa>

Escreva, em PT-BR, máximo 5 bullets:
- Compatibilidade do scanner/impressora/CAD atual com o produto X
- 1 gancho de upgrade contra cada concorrente (sem mentir, usar specs reais)
- 1 alerta de risco (não empurrar, ordem natural do fluxo)
NÃO invente produtos. Use só os listados em "combo".
```

Reaproveita o cliente DeepSeek que já existe em `smart-ops-lia-assign`. Custo marginal (~$0.0005/lead). Determinístico falha-suave: se DeepSeek falhar, o bloco "Como posicionar" é omitido — perguntas e combo continuam.

### Camada 3 — render

Helpers `renderDiagnosisHTML(diag, llmScript)` e `renderDiagnosisWhatsApp(diag, llmScript)`:
- **PipeRun (HTML)**: bloco completo com as 5 seções do exemplo acima.
- **WhatsApp (texto)**: versão enxuta — etapa atual, intent, top 3 perguntas, top 3 combo, 1 linha de posicionamento.

Inserido **antes do bloco 🧠 Inteligência** em `buildSellerDealSummaryHTML` e logo após o cabeçalho do lead em `buildSellerNotification`.

### Camada 4 — prompt cognitivo

`cognitive-lead-analysis/index.ts` recebe `diag.stack_atual` + `diag.intent` no bloco "Perfil técnico (SDR Qualificação)" para classificar `lead_stage_detected` e `recommended_approach` ancorado na régua 7×3 oficial (deixa de inferir do zero).

## Arquivos

- `supabase/functions/_shared/workflow-diagnosis.ts` (**novo**, ~280 linhas determinísticas + 1 helper LLM)
- `supabase/functions/_shared/workflow-prereq-rules.ts` (**novo**, tabela curta de pré-req entre etapas + mapa label→pergunta)
- `supabase/functions/_shared/seller-summary.ts` (chama `diagnoseLead` + `renderDiagnosisHTML`, ~25 linhas adicionadas)
- `supabase/functions/smart-ops-lia-assign/index.ts` (chama `diagnoseLead` + `renderDiagnosisWhatsApp` em `buildSellerNotification`; injeta `stack_atual`/`intent` no prompt cognitivo)
- `supabase/functions/cognitive-lead-analysis/index.ts` (recebe e usa o diagnóstico)
- `supabase/functions/smart-ops-preview-seller-note/index.ts` (já planejado — passa a renderizar o novo bloco automaticamente)
- `mem/smart-ops/seller-note-workflow-diagnosis.md` (memória nova documentando a régua e o contrato)

## Validação

Rodar o preview function contra:
1. `criatianobrazodonto@gmail.com` (caso real do usuário)
2. Caso GlazeON sintético: lead com `equip_scanner='CS 3600'`, `equip_impressora='Anycubic'`, `especialidade='implantodontia'`, `produto_interesse='GlazeON'` → esperar saída próxima do exemplo acima.
3. Lead "pesado" (já tem Rayshape + exocad + GlazeON) → esperar combo focar em etapa 6 (cursos) e etapa 7 (fresagem), sem re-ofertar o que ele tem.
4. Lead "vazio" (só nome + email) → diagnóstico devolve só as perguntas-base, sem alucinar combo.

## O que NÃO muda

- `workflow_cell_mappings` continua editável só pelo `SmartOpsMappingFieldsEditor` (read-only para esse recurso).
- Nenhuma migration. Nenhuma coluna nova em `lia_attendances`.
- Sem postar nada em produção até preview aprovado pelo usuário (rota `smart-ops-preview-seller-note`).
- `[🤖 SmartOps]` / `[Dra. L.I.A.]` permanecem como assunto separado.
- `ingest-lead`, `deal-form-note`, hierarchy e RR não são tocados.
