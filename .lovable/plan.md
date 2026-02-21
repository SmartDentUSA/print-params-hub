

# Fix: Dra. LIA Hallucinating Products + SPIN Loop + Route Confusion

## Root Cause Analysis

The Dra. LIA is **inventing products** (Smart Print One, Smart Print Pro, RayShape P8/P10, Medit i700, Medit i600) that do NOT exist in the database. The actual catalog contains:
- **Impressoras:** Rayshape Edge Mini, Asiga MAX 2, Asiga Ultra, Elegoo Mars 5 Ultra
- **Scanners:** BLZ INO100 Plus, BLZ INO200, Scanner de Bancada Medit T310, Scanner de Bancada BLZ LS100
- **Combos:** Chair Side Print 4.0 (various configurations)

This happens because:
1. The RAG search in commercial mode returns weak/no results for product queries (company_kb has weight 2.0 but catalog_product only 0.8)
2. When RAG is empty, the AI fabricates product names from its training data
3. There is NO direct catalog query for commercial product requests

Additionally, the SPIN loop persists because the prompt-based anti-loop rules are too long/complex for the LLM to follow reliably.

## Changes

### 1. Add direct catalog product search for commercial context (`dra-lia/index.ts`)

Create a new function `searchCatalogProducts()` that queries `system_a_catalog` directly when the user mentions keywords like "impressora", "scanner", "opcoes", "equipamento", "quais tem", "o que voce tem". This ensures the AI has REAL product data.

```text
async function searchCatalogProducts(supabase, message, history):
  - Detect product-interest keywords in message
  - Query system_a_catalog for matching product_category (IMPRESSAO 3D, SCANNERS 3D, POS-IMPRESSAO, SOLUCOES)
  - Return structured results with name, description (truncated), cta_1_url
  - Inject as source_type "catalog_product" with high similarity (0.90)
```

Call this function in parallel with other searches when `topic_context === "commercial"`.

### 2. Fix topic weights for commercial context

Change commercial weights so catalog products rank much higher:

```text
commercial: {
  parameter_set: 0.2,
  resin: 0.5,
  processing_protocol: 0.3,
  article: 0.4,
  video: 0.3,
  catalog_product: 2.5,  // was 0.8
  company_kb: 1.5         // was 2.0
}
```

### 3. Add hard anti-hallucination rule for commercial product mentions

Add to the system prompt SDR section:

```text
**REGRA ANTI-ALUCINACAO COMERCIAL (CRITICA):**
Quando o lead perguntar sobre produtos, equipamentos, impressoras ou scanners:
- CITE APENAS produtos que aparecem nos DADOS DAS FONTES abaixo
- Se nenhum produto relevante aparece nas fontes, diga: "Deixa eu verificar nosso catalogo atualizado. Para te passar as opcoes certas com valores, posso te conectar com nosso time comercial via WhatsApp?"
- NUNCA invente nomes de produtos como "Smart Print One", "Smart Print Pro" etc
- NUNCA cite modelos de scanner ou impressora que NAO estao nas fontes
```

### 4. Simplify SPIN anti-loop with extracted_entities persistence

Instead of relying on regex history analysis, persist SPIN stage in `extracted_entities` after each interaction. Before generating the AI response, load the session's `extracted_entities` and inject a concise "completed stages" summary:

```text
// After AI response, parse for completed stages and update extracted_entities:
extracted_entities.spin_stage = "etapa_3"  // based on what was discussed
extracted_entities.specialty = "implantodontia"
extracted_entities.equipment = "analogico"
extracted_entities.pain_point = "demora escaneamento"
```

Then inject into prompt: "ETAPAS JA COMPLETADAS: especialidade=implantodontia, equipamento=analogico, dor=demora. NAO pergunte sobre estes temas novamente. Avance para etapa 4."

### 5. Reduce max_tokens for commercial responses

Change `max_tokens` from 1024 to 512 when `topic_context === "commercial"` to force shorter responses and prevent verbosity.

## Implementation Sequence

1. Add `searchCatalogProducts()` function
2. Update commercial topic weights
3. Add anti-hallucination rule to SDR prompt
4. Add extracted_entities persistence for SPIN tracking
5. Reduce max_tokens for commercial
6. Deploy edge function

## Expected Results

- LIA only mentions products that exist in the database
- When user asks "quais impressoras voce tem?", LIA lists Rayshape Edge Mini, Asiga MAX 2, Asiga Ultra (real products)
- SPIN stages are tracked in the database, preventing loops even across sessions
- Shorter, more direct responses in commercial context

