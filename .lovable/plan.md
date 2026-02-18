
# Importar Apostila JSON como Base de Conhecimento da Dra. L.I.A. e Enriquecer Resinas/Catálogo

## Diagnóstico: O que este JSON contém

O arquivo `apostila-2026-02-18.json` é uma exportação completa do "Sistema A" da Smart Dent com **126.328 linhas**, contendo:

| Seção | Conteúdo relevante |
|---|---|
| `data.company` | Descrição da empresa, missão, valores, canais, reviews Google, redes sociais |
| `data.products` | ~50+ produtos com name, description, keywords, sales_pitch, FAQs, technical_specifications, seo_title_override, seo_description_override, image_url, resource_cta1/2/3, document_transcriptions (PDFs já transcritos por IA) |
| `data.categories` | Categorias e subcategorias de produtos |
| `data.kols` | Key Opinion Leaders (dentistas parceiros) |
| `data.testimonials` | Depoimentos em vídeo |
| `data.reviews` | Reviews do Google |
| `data.blogs` | Artigos de blog/conteúdo |
| `data.milestones` | Marcos da história da empresa |

**Dados mais valiosos para a Dra. L.I.A.:**
- `sales_pitch` — discurso comercial/técnico de cada produto
- `technical_specifications` — specs técnicas (label + value)
- `document_transcriptions[].extracted_data` — conteúdo de PDFs já extraído por IA (keywords, benefits, features, usage_instructions, document_sections)
- `seo_title_override` e `seo_description_override` — descrições otimizadas prontas
- `faq[]` — perguntas e respostas por produto
- `keywords[]`, `benefits[]`, `features[]` — dados estruturados

## Estratégia de importação — 3 objetivos paralelos

```text
JSON Apostila
      │
      ├─► 1. system_a_catalog (upsert produtos)
      │         ↓
      │         ↓ via import-system-a-json (já existe, precisa ajuste)
      │
      ├─► 2. resins (enriquecer descrição + ai_context)
      │         ↓
      │         ↓ via função nova: enrich-resins-from-apostila
      │
      └─► 3. agent_embeddings (indexar como chunks RAG para Dra. L.I.A.)
                ↓
                ↓ via index-embeddings (já existe, pode ser reaproveitado)
```

## O que será construído

### Parte 1 — Adaptar `import-system-a-json` para o novo schema JSON

O JSON enviado tem estrutura `{ meta: {...}, data: { company, products, categories, kols, ... } }`, **diferente do schema esperado pela função** (que esperava `data.products`, `data.company_profile`, etc.).

Ajustes necessários no `import-system-a-json/index.ts`:
- Detectar e normalizar o novo schema: `data.company` → `company_profile`, `data.products` → `products`
- Mapear o campo `sales_pitch` como `description` quando `description` estiver vazio
- Mapear `seo_description_override` → `meta_description`
- Mapear `seo_title_override` → `seo_title_override` (já correto)
- Mapear `resource_cta1/2/3.url` e `.label` para os campos CTA

### Parte 2 — Nova edge function: `enrich-resins-from-apostila`

Esta função recebe o JSON, encontra produtos cujo nome bate com resinas da tabela `resins`, e enriquece os campos de descrição e `ai_context`:

```typescript
// Para cada produto do JSON que seja uma resina (ex: "Smart Print Bio Vitality"):
// 1. Buscar na tabela resins por name ILIKE %nome%
// 2. Se encontrar, atualizar:
//    - description: sales_pitch ou description do produto
//    - ai_context: juntar keywords + benefits + features para busca
//    - processing_instructions: manter o existente (não sobrescrever)
//    - meta_description: seo_description_override
//    - keywords: keywords do produto
```

O `ai_context` é o campo que a Dra. L.I.A. já usa no ILIKE para expandir a busca. Preenchê-lo com sinônimos, benefícios e palavras-chave de cada produto melhora drasticamente a relevância das respostas.

### Parte 3 — Indexar produto-chunks no `agent_embeddings`

A tabela `agent_embeddings` já é a fonte de verdade para o RAG vetorial da Dra. L.I.A. Produtos com `document_transcriptions[].extracted_data` são muito ricos — cada produto pode virar 2-3 chunks:

- **Chunk 1 (produto)**: `{name} | {sales_pitch} | Benefícios: {benefits.join()} | Features: {features.join()}`
- **Chunk 2 (specs técnicas)**: `{name} Especificações: {technical_specifications.map(s => s.label + ': ' + s.value).join(' | ')}`
- **Chunk 3 (FAQ)**: `{name} FAQ: {faq.map(f => f.question + ' ' + f.answer).join(' | ')}` (primeiras 1000 chars)

A edge function `index-embeddings` existente já sabe criar chunks — será estendida para incluir produtos do `system_a_catalog` como source_type `product`.

### Parte 4 — UI de importação no Admin (componente novo)

Um botão no painel admin que permite fazer upload do JSON e aciona as 3 etapas em sequência, com feedback de progresso.

---

## Arquivos a criar/modificar

| Arquivo | Ação | Descrição |
|---|---|---|
| `supabase/functions/import-system-a-json/index.ts` | Modificar | Normalizar schema do novo JSON, mapear sales_pitch, seo_description_override, CTAs |
| `supabase/functions/enrich-resins-from-apostila/index.ts` | Criar (novo) | Ler produtos do JSON, cruzar com tabela `resins` por nome, atualizar description + ai_context + keywords |
| `supabase/functions/index-embeddings/index.ts` | Modificar | Adicionar source_type `product` buscando em `system_a_catalog` (category = product ou resin) |
| `src/components/AdminApostilaImporter.tsx` | Criar (novo) | Upload do JSON + 3 botões de ação: Importar Catálogo, Enriquecer Resinas, Indexar Embeddings |
| `src/pages/AdminViewSupabase.tsx` | Modificar | Adicionar o novo componente `AdminApostilaImporter` na seção de importações |
| `supabase/config.toml` | Modificar | Adicionar `[functions.enrich-resins-from-apostila]` com `verify_jwt = false` |

---

## Como funciona o fluxo completo

```text
Admin faz upload do JSON no painel
              │
              ▼
[Botão 1] Importar Produtos → POST /import-system-a-json
  → Normaliza schema
  → Upsert em system_a_catalog (company, products, categories, testimonials, reviews)
  → Relatório: X produtos importados, Y atualizados
              │
              ▼
[Botão 2] Enriquecer Resinas → POST /enrich-resins-from-apostila
  → Percorre produtos do JSON que sejam resinas
  → Cruza com tabela resins por nome
  → Atualiza: description, ai_context, meta_description, keywords
  → Relatório: X resinas enriquecidas
              │
              ▼
[Botão 3] Indexar para Dra. L.I.A. → POST /index-embeddings?mode=incremental&sources=products
  → Gera chunks dos produtos do system_a_catalog
  → Cria/atualiza embeddings vetoriais na tabela agent_embeddings
  → Relatório: X chunks indexados
```

---

## Detalhes técnicos da nova edge function `enrich-resins-from-apostila`

```typescript
// Lógica de match por nome:
// produto.name: "Resina 3D Smart Print Bio Vitality"
// resina.name: "Smart Print Bio Vitality"
// → Match: produto.name ILIKE %resina.name% OU resina.name ILIKE %palavrasChave%

// O que é escrito em resins.ai_context:
const aiContext = [
  product.keywords?.join(', '),
  product.benefits?.join('. '),
  product.features?.join('. '),
  product.market_keywords?.join(', '),
  product.bot_trigger_words?.join(', '),
].filter(Boolean).join('\n\n');
```

Isso diretamente melhora a Dra. L.I.A. porque o ILIKE já busca em `ai_context` (implementado no último deploy).

## Seção Técnica

- O JSON tem 126.328 linhas e **não pode ser enviado como body de request** (limite ~6MB em edge functions Deno). A estratégia é: o admin faz upload do arquivo, o frontend lê com `FileReader`, e envia o JSON parseado em partes (paginado por lotes de 20 produtos).
- O `import-system-a-json` já tem lógica de upsert por `(source, external_id)` — nenhuma migração de banco necessária.
- O enriquecimento de resinas usa `update` — nunca sobrescreve `processing_instructions` (campo crítico).
- Os embeddings são gerados via Lovable AI Gateway (`openai/text-embedding-3-small`, 768 dims) — o mesmo modelo já em uso.
- O admin component usará `supabase.functions.invoke()` diretamente, sem precisar de URLs expostas.
- Deploy de 2 edge functions novas + 2 modificações necessárias.
