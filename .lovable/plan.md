## Objetivo

A camada LLM do `workflow-diagnosis.ts` hoje gera o "Como posicionar" a partir só do nome do produto-intenção + combo. Vamos passar a **alimentar o prompt com o RAG real da Smart Dent** (mesma base que a apostila/Dra. LIA usam) para que o argumento seja construído sobre **specs, benefícios, indicações clínicas e diferenciais reais do produto que o lead pediu**, mais um **dossiê Rayshape obrigatório** sempre que o lead tem (ou demonstra interesse em) impressora 3D.

Premissa do usuário codificada no prompt: *"Impressoras genéricas têm limitações operacionais; a Rayshape elimina essas dificuldades e é sempre superior em facilidade de uso no fluxo digital odontológico."* — usar como âncora narrativa, sem inventar specs.

## Como funciona

### 1. Novo módulo `_shared/product-rag.ts`

Função `fetchProductDossier(supabase, productLabel)`:
- Resolve o produto contra `system_a_catalog` (match por `name` ILIKE + tokens, fallback `slug`, depois `keywords`).
- Devolve dossiê compacto (≤ 1.2 KB) montado a partir de:
  - `name`, `product_category`, `product_subcategory`
  - `description` (truncado 600 chars)
  - `extra_data.benefits` (top 5)
  - `extra_data.technical_specifications` (top 6 label:value)
  - `extra_data.faq` (top 3 P/R)
  - `clinical_indications`, `compatibility_list`, `contraindications` (top 3 cada)
- Cache em memória 5 min (mesmo padrão do mapping cache).

Função `fetchRayshapeDossier(supabase)` — atalho fixo: busca pelo slug `rayshape` / nome `Rayshape` e devolve o mesmo formato. Cacheado.

### 2. Enriquecer `generatePositioningScript`

Antes do prompt DeepSeek:
- Resolver dossiê do produto de intenção (`diag.intent.matched_product_label` ou `diag.intent.produto`).
- Resolver dossiês dos itens do `combo_sugerido.mesma_celula` (top 2, paralelo).
- Se `concorrentes_detectados` contém impressora **ou** `stack_atual` tem `etapa_3_impressao` com competitor **ou** intent cai em etapa 3/4/5 → anexar dossiê Rayshape.

Prompt atualizado (estrutura, em PT-BR, mantém soft-fail e cap de 400 tokens):

```
Você é consultor técnico Smart Dent. NÃO invente specs nem preços.
Use SOMENTE os fatos abaixo (RAG oficial Smart Dent).

LEAD: <especialidade>, stack=<…>, concorrentes=<…>
INTENÇÃO: <produto + etapa/célula>
LACUNAS: <…>
COMBO (motor 7×3): <…>

DOSSIÊ DO PRODUTO DE INTENÇÃO (RAG):
<bloco compacto: descrição, benefícios, specs, indicações, compatibilidade>

DOSSIÊS DOS PRODUTOS DO COMBO (RAG):
<até 2 blocos curtos>

[se aplicável]
DOSSIÊ RAYSHAPE (RAG) — usar como referência quando impressora aparecer:
<bloco>
REGRA RAYSHAPE: Impressoras genéricas (Anycubic, Phrozen, Elegoo, etc.) têm
limitações operacionais (curva de calibração, perda de produtividade, perfis
não validados). A Rayshape elimina essas dificuldades e é sempre superior em
facilidade no fluxo digital odontológico. Use isso como gancho de upgrade,
sem mentir sobre specs — cite só o que estiver no DOSSIÊ RAYSHAPE.

ESCREVA, em PT-BR, MÁXIMO 5 bullets ("• "):
1) Como o produto de intenção se conecta ao stack atual (compatibilidade real do dossiê)
2) 1 gancho contra cada concorrente detectado, apoiado em specs do dossiê
3) Quando impressora estiver envolvida: 1 bullet de posicionamento Rayshape
4) 1 alerta de risco (não empurrar fora da ordem do fluxo digital)
```

DeepSeek continua sendo o motor; só o **contexto** vira RAG real em vez de só rótulos.

### 3. Falha-suave

- Se `fetchProductDossier` não acha o produto → segue só com nome (comportamento atual).
- Se `fetchRayshapeDossier` falha → omite a seção Rayshape (regra/bullet some).
- Se DeepSeek timeout → `llm_script` undefined, perguntas + combo continuam (igual hoje).

### 4. Render

Sem mudanças na assinatura dos renderers. O conteúdo dos bullets fica mais técnico/ancorado, mas o layout HTML/WhatsApp/prompt cognitivo permanece igual.

### 5. Cognitive prompt

`renderDiagnosisForPrompt` ganha 1 linha extra no fim: `produto_intencao_resumo`= 1ª frase da `description` do dossiê (quando existir) — ajuda o DeepSeek do `cognitive-lead-analysis` a classificar `recommended_approach` ancorado no produto real.

## Arquivos

- `supabase/functions/_shared/product-rag.ts` (**novo**, ~140 linhas — fetch + cache + formatter)
- `supabase/functions/_shared/workflow-diagnosis.ts` (substitui o corpo de `generatePositioningScript` para injetar dossiês; adiciona linha no `renderDiagnosisForPrompt`)
- `mem/smart-ops/seller-note-workflow-diagnosis.md` (atualiza: agora consome RAG `system_a_catalog` + Rayshape rule)

## Validação (via `smart-ops-preview-seller-note`)

1. `criatianobrazodonto@gmail.com` (real) — confirmar que bullets citam specs reais dos produtos do combo.
2. Lead sintético GlazeON + CS 3600 + Anycubic → esperar bullet Rayshape com gancho de produtividade citando spec real do dossiê.
3. Lead com produto-intenção que **não existe** no catálogo (ex: "Bio Splint XL") → soft-fail, bullets continuam (sem dossiê).
4. Lead sem impressora declarada e intent em etapa 1 (scanner) → sem bullet Rayshape (regra não aciona).

## O que NÃO muda

- `workflow_cell_mappings` continua read-only para esse fluxo.
- Sem migration. Sem coluna nova.
- `system_a_catalog` é só leitura.
- WhatsApp/PipeRun/cognitive prompt — mesmas seções, mesma ordem, mesmo hash de dedupe.
- Sem postar em produção até preview aprovado.
