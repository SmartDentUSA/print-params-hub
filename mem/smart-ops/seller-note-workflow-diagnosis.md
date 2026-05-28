---
name: Seller Note 7×3 Workflow Diagnosis
description: PipeRun seller note + WhatsApp briefing + cognitive prompt consume `_shared/workflow-diagnosis.ts` which cross-refs lead stack vs workflow_cell_mappings (Motor 7×3) and outputs a SPIN briefing (Situação/Dores/Implicações/Ponte ao produto/Perguntas SPIN) gerado por heurística + Gemini estruturado
type: feature
---

**Module**: `supabase/functions/_shared/workflow-diagnosis.ts`

**Inputs (read-only)**:
- `workflow_cell_mappings` (cached 5 min) — products / sdr_fields / competitors per `workflow_stage` × `workflow_cell`
- `lia_attendances.*` (canonical row, `merged_into IS NULL`)
- `smartops_form_field_responses` (latest 80, indexed by `field_name` + `field_label`)
- `lia_attendances.raw_payload.custom_fields`
- `system_a_catalog` (cached 5 min via `_shared/product-rag.ts`) — RAG dossiers (description, benefits, technical_specs, faq, clinical_indications, compatibility_list, contraindications) used to ground the LLM positioning script

**Output `WorkflowDiagnosis`**:
- `stack_atual`: which cells have data, value found, whether it matches a competitor on that cell
- `intent`: produto_interesse / produto_interesse_auto / form_name / resina_interesse resolved against product labels of the mapping (substring + token match) → target_stage/target_cell
- `lacunas`: prereq stages (STAGE_PREREQS) without data, plus target_cell itself if empty
- `combo_sugerido`: top 3 products of intent cell + top 2 of next adjacent stage + top 1 course if etapa_6 vazia
- `perguntas_qualificacao`: derived from `sdr_field` labels of the intent cell + lacuna cells that are empty on the lead (mapped via QUESTION_TEMPLATES)
- `concorrentes_detectados`: flagged when lead value matches a `competitor` mapped_value on the same cell
- `llm_script`: optional 5-bullet DeepSeek positioning (12s timeout, soft-fail, max_tokens=400). Disable with `{ enableLLM: false }`.

**Positioning script grounding (RAG)**:
- Always fetches `fetchProductDossier(intent.matched_product_label || intent.produto)` from `system_a_catalog`.
- Fetches dossiers for top 2 products of `combo_sugerido.mesma_celula` (parallel).
- When a printer is involved (competitor printer OR stack has `etapa_3_impressao` OR intent target stage ∈ {3,4,5}), fetches the Rayshape dossier and appends a fixed REGRA RAYSHAPE: "impressoras genéricas têm limitações operacionais; Rayshape elimina e é sempre superior em facilidade no fluxo digital odontológico — citar apenas specs do dossiê".
- All dossiers injected into DeepSeek prompt under "=== RAG OFICIAL SMART DENT ===" with explicit instruction to use ONLY these facts, no invented specs/prices.
- Soft-fail: if a dossier is not found in `system_a_catalog`, that block is omitted and the bullet falls back to the label only.

**SPIN Briefing (saída principal — `diag.spin`)**:
- `seedSpinBriefing()` gera situação + dores prováveis + implicações + perguntas SPIN a partir de stack/concorrentes/lacunas (heurística determinística — funciona sem LLM).
- `enrichSpinWithLLM()` chama Gemini (`google/gemini-3-flash-preview`, gateway Lovable, response_format json_object, max_tokens 1200, timeout 15s) passando o seed + dossiês RAG (intenção + Rayshape quando impressora envolvida) para refinar com termos específicos do lead (cita scanner/CAD/impressora pelo nome, implicações concretas em hora-cadeira/peças-mês, ponte com 1 spec do dossiê). Soft-fail volta ao seed.
- Estrutura: `{ situacao, dores_provaveis:[{dor,evidencia}], implicacoes[], ponte_produto, perguntas_spin:{situacao,problema,implicacao,necessidade}, alerta_lacuna? }`.
- `llm_script` (formato antigo de 5 bullets) preservado como fallback secundário.

**Renderers**:
- `renderDiagnosisHTML(diag)` — bloco PipeRun com seções SITUAÇÃO → DORES PROVÁVEIS → IMPLICAÇÕES → PONTE → PERGUNTAS SPIN (S/P/I/N) → COMBO → ALERTA. Injected em `_shared/seller-summary.ts`.
- `renderDiagnosisWhatsApp(diag)` — versão enxuta 8-10 linhas (Situação, Dor#1, Impacto, Ponte, 4 perguntas S/P/I/N, combo, alerta). Injected em `smart-ops-lia-assign/buildSellerNotification`.
- `renderDiagnosisForPrompt(diag)` — texto plano para `cognitive-lead-analysis` ancorar `recommended_approach` em SPIN ao invés de só stack/lacunas.

**Preview / verification**: edge function `smart-ops-preview-seller-note` (`verify_jwt=false`). GET `?email=` / `?lead_id=` / `?piperun_id=` returns `{ diagnosis, diagnosis_html, diagnosis_whatsapp_text, piperun_note_html, piperun_note_hash }` without posting to PipeRun/WhatsApp/DB.

**Config**: `STAGE_ORDER`, `STAGE_LABEL`, `STAGE_PREREQS`, `QUESTION_TEMPLATES` são tabelas curtas hardcoded no módulo. Edição produto/concorrente/sdr_field continua 100% no `SmartOpsMappingFieldsEditor`.

**PipeRun posting (lia-assign)**: as 3 chamadas de nota no `smart-ops-lia-assign` (`updateExistingDeal`, `moveDealToVendas`, `createNewDeal`) agora passam pelo helper `postRichSellerNote`, que usa `buildSellerDealSummaryHTML` (Resumo do Lead completo + bloco 7×3 + RAG + Rayshape) com idempotência por `last_seller_note_hash` / `last_seller_note_at` (skip se hash idêntico, throttle se <5 min). Reativação preserva o cabeçalho `🔄 Deal reativado` via `headerPrefix`. Em caso de erro do builder, faz fallback para o `buildDealNoteHTML` legado (mantido como deprecated). Notas curtas de auditoria (enrichment tag, owner bloqueado, razão social) continuam usando `addDealNote` direto.

**Falha-suave**: se `workflow_cell_mappings` estiver vazio, `diagnoseLead` retorna estrutura vazia e os renderers devolvem string vazia → nota/briefing seguem sem o bloco. Se DeepSeek cair, `llm_script` fica undefined e os outros campos seguem.

**Falha-suave SPIN**: se Gemini falhar/timeout, `diag.spin` mantém o seed heurístico (situação genérica + dores baseadas em concorrente/lacuna + perguntas SPIN com placeholders do stack). Renderers nunca quebram.

**Intent-vs-Stack Separation (CRÍTICO)**: produto vindo de `form_name` / `produto_interesse` / `produto_interesse_auto` / campanha é SEMPRE alvo de compra, NUNCA equipamento instalado. Guardas em `diagnoseLead`:
- `declared_empty_cells` (novo campo do `WorkflowDiagnosis`): células onde sdr_field de equipamento (`equip|printer|scanner|impress|cad|fresa|forno|cura`) veio com valor explícito "não/nao/n/a/—/nenhum".
- Scrubbing pós-`resolveIntent`: remove de `stack_atual` qualquer entrada cujo `value` bata com `intent.matched_product_label`/`intent.produto` E cujo `field`/`field_label` case com regex de interesse (`interesse|busca|deseja|quer|procura|alvo|gostaria|pretende`) — evita que resposta tipo "qual impressora você busca? RayShape" vire stack instalado.
- Scrubbing extra: em células marcadas em `declaredEmpty`, derruba entradas de stack que não vêm de campo de equipamento.
- `seedSpinBriefing` calcula `targetNotOwned` (alvo não consta no stack OU célula-alvo em `declared_empty_cells`) e troca a situação para "ainda sem `<etapa-alvo>` próprio, avaliando adquirir `<produto>`", troca a primeira pergunta de SITUAÇÃO para "como você resolve `<etapa>` hoje — terceiriza/laboratório/não faz?" e adiciona pergunta-âncora de PROBLEMA "o que te levou a olhar `<produto>` agora?".
- Prompt do LLM recebe linhas `Células declaradas SEM equipamento` e `Status do produto-alvo` (`AINDA NÃO POSSUI — busca adquirir` | `já consta no stack instalado`) + regra dura proibindo afirmar posse e ditando o foco das perguntas de SITUAÇÃO/PROBLEMA quando o alvo não foi adquirido.

**Intent-leak por VALOR (reforço)**: além do match por tokens, `diagnoseLead` derruba qualquer entrada de `stack_atual` cujo `value` cru case com `INTEREST_VALUE_RE` (`^sdr:`, `interesse em`, `busca por`, `procurando`, `gostaria de`, `deseja adquirir`, `pretendo comprar`). Esses valores nunca representam equipamento instalado, independente do nome do campo. Stopwords do tokenize foram reduzidas (removidos `scanner`, `impressora`, `intraoral`, `bancada`, `resina`, `software`, `3d`, `edge`, `mini`) para não esconder overlap legítimo. `seedSpinBriefing` também filtra esses valores antes de montar a pergunta S.

**SPIN ancorada no fluxo 7×3**: todas as perguntas S/P/N são prefixadas com `Etapa <nome>:` quando referenciam uma etapa específica. Regra dura no prompt do LLM exige o prefixo e exige que a pergunta de NECESSIDADE nomeie EXPLICITAMENTE o produto Smart Dent que resolve a etapa (nada de "uma solução genérica").

**Lane obrigatória de RESINAS & CONSUMÍVEIS (core de recorrência)**: sempre que `intent.target_stage ∈ {1·Scanner, 2·CAD, 3·Impressão, 4·Pós, 5·Finalização, 7·Fresagem}` OU stack contém `etapa_3_impressao`, `seedSpinBriefing` injeta automaticamente:
- 2 perguntas P: (a) qual resina/aplicação/consumo mensal; (b) protocolo de lavagem + cura validado pelo fabricante.
- 1 pergunta N de cross-sell: combo `<produto-alvo> + pacote de resinas Smart Dent + protocolo de pós-cura + kit inicial de consumíveis`.
Regra dura no prompt do LLM repete a obrigatoriedade — sem resinas + protocolo o briefing está incompleto.

**Bugfix `[object object]`**: `live.document_extracts[].key_specs` pode conter objetos (não só strings). `seedSpinBriefing` agora coage cada item via `String(o.label ?? o.name ?? o.spec ?? o.title ?? o.value)` antes de gerar a pergunta de compatibilidade.

**Bugfix LLM prompt**: `enrichSpinWithLLM` agora computa `declaredEmptyTxt` e `ownershipStatus` localmente (antes referenciava variáveis do escopo de `generatePositioningScript`, causando ReferenceError silencioso e fazendo a chamada cair sempre no seed).

**Roteiro Canônico de Perfilamento (espinha dorsal da SPIN)** — `buildLeadProfilingRoteiro(lead)` deriva 9 itens fixos espelhando o formulário `# - Formulário exocad I.A.`:
1. Perfil (área/especialidade) · 2. Captura/Scanner · 3. CAD · 4. Impressora 3D · 5. Modelos · 6. Placas miorrelaxantes · 7. Elementos LD · 8. Guias cirúrgicas · 9. Recorrência (consumo/fornecedor).
Cada item recebe `status`:
- `declarado` (valor presente no `lia_attendances`),
- `a_descobrir` (valor vazio → vendedor PERGUNTA usando `pergunta_canonica`),
- `gap_ofensivo` (valor casa `ROTEIRO_NEG_RE` = `^(não|nao|ainda não|n/a|nenhum|sem|—|0)` → terceiriza/não internalizou; carrega `gancho_smartdent` da etapa).

`seedSpinBriefing` agora deriva 1:1 as perguntas de SITUAÇÃO a partir dos itens `a_descobrir`+`gap_ofensivo`, NA ORDEM do roteiro (até 9 perguntas). Itens `gap_ofensivo` também viram pergunta de PROBLEMA atacando a terceirização. Quando tudo está `declarado`, gera apenas reconhecimento + foco no gargalo do alvo.

`renderDiagnosisHTML` injeta o bloco **🧩 ROTEIRO DE PERFILAMENTO** entre `Concorrentes` e `DORES PROVÁVEIS` (✅/❓/⚠️ por item). `renderDiagnosisWhatsApp` lista os 3 primeiros itens pendentes. `renderDiagnosisForPrompt` resume `Roteiro: X declarados / Y a descobrir / Z gaps`.

Prompt do LLM recebe novo bloco `ROTEIRO DE PERFILAMENTO (rota fixa do formulário exocad I.A. — NÃO reordene, NÃO pule)` + regra dura: perguntas de SITUAÇÃO devem cobrir EXATAMENTE os itens `❓`/`⚠️` na mesma ordem 1→9; itens `✅` viram só reconhecimento; itens `⚠️` viram também 1 P-question por item. O `roteiro_perfilamento` retornado pelo LLM é descartado — usamos sempre o do seed (determinístico, derivado direto das colunas do lead).

Substitui a "lane obrigatória de resinas" anterior (que era genérica): resinas e protocolo agora estão estruturadas como itens 5-9 do roteiro, e cada gap automaticamente vira pergunta + gancho Smart Dent (Resina Model/Splint/Permanente/Surgical Guide, kit recorrente).
