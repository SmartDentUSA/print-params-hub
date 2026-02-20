
# Indexar todos os produtos do System A no RAG da L.I.A.

## Diagnóstico completo do problema

A pergunta "o que tem de especial na RayShape Edge Mini?" expõe um gap arquitetural fundamental.

### Onde os dados dos produtos REALMENTE estão

O endpoint externo (`ai_training`) contém apenas **keywords e links** dos produtos — útil para SEO, mas sem a descrição técnica. Os dados ricos ficam em dois lugares:

**1. Tabela `system_a_catalog` (Supabase local) — NUNCA indexada no RAG:**

| Dado | Quantidade |
|---|---|
| Produtos ativos | 116 |
| Com descrição completa | 116 (inclui texto comercial/técnico detalhado) |
| Com `extra_data.benefits` (lista de diferenciais) | 106 |
| Com `extra_data.faq` (perguntas e respostas do produto) | 106 |
| Outros registros (testemunhos, reviews) | 243 |

**2. Endpoint externo (`ai_training`) — parcialmente indexado:**
- ✅ Perfil da empresa, parcerias, histórico
- ❌ **Produtos: apenas keywords, sem descrição técnica**

### Exemplo: RayShape Edge Mini (o que a L.I.A. não sabe hoje)

A tabela `system_a_catalog` tem para esse produto:
- Descrição completa: "Zero dor de cabeça: nivelamento automático, aquecimento de tanque... Uma coroa em 17 minutos. Uma faceta em 12 minutos..."
- Benefits: ["Nivelamento Automático", "Software ShapeWare 2.0 com IA", "Conectividade Versátil", "Plataformas Normal e Reduzida", ...]
- FAQs: "Quais formatos de arquivo são compatíveis?", "Quais as principais vantagens vs. métodos tradicionais?", "Como otimiza o ROI?"

**Nada disso está no RAG** — por isso a L.I.A. responde apenas com o que existe nos artigos publicados.

### Por que o endpoint externo `?format=json` não resolve sozinho

O formato JSON do endpoint tem 61.706 linhas e mais de 38.341 campos — impossível fazer fetch e parsear isso dentro do timeout de 15s de uma edge function de indexação. **A solução correta é ler diretamente da tabela `system_a_catalog`**, que já está sincronizada no Supabase e tem acesso instantâneo.

## Solução: Nova stage `catalog_products` no `index-embeddings`

Adicionar uma **6ª fonte de dados** na edge function `index-embeddings`, lendo diretamente da tabela `system_a_catalog`, gerando 2–3 chunks por produto para cobrir todos os ângulos semânticos.

### Estratégia de chunking por produto

Para cada produto com `category = 'product'` e `active = true`:

**Chunk 1 — Descrição + Categoria** (principal, responde "o que é esse produto"):
```text
"RayShape Edge Mini — Impressora 3D Odontológica | IMPRESSÃO 3D > IMPRESSORAS ODONTOLÓGICAS | 
O que é o grande problema que o dentista digital hoje ao implementar o fluxo chair...
nivelamento automático e aquecimento de tanque... Uma coroa em 17 minutos. Uma faceta em 12 minutos..."
```

**Chunk 2 — Benefits** (responde "quais os diferenciais/vantagens"):
```text
"RayShape Edge Mini — Diferenciais e Benefícios | 
Nivelamento Automático – sem ajustes manuais | 
Aquecimento de Tanque e Resina – consistência em qualquer condição | 
Software ShapeWare 2.0 com IA – simplifica o fluxo digital | ..."
```

**Chunk 3 — FAQ** (responde perguntas específicas dos clientes):
```text
"RayShape Edge Mini — Perguntas e Respostas | 
P: Quais formatos de arquivo são compatíveis? R: STL e OBJ, padrões na odontologia digital... | 
P: Quais as vantagens vs. métodos tradicionais? R: fluxo simplificado, nivelamento automático..."
```

### Estimativa de chunks novos

| Fonte | Chunks |
|---|---|
| 116 produtos × descrição (chunk 1) | 116 |
| 106 produtos × benefits (chunk 2) | 106 |
| 106 produtos × FAQs (chunk 3, agrupadas) | 106 |
| **Total estimado** | **~328 novos chunks** |

Esses chunks vão para `agent_embeddings` com `source_type = "catalog_product"`.

## Implementação técnica

### Arquivo único: `supabase/functions/index-embeddings/index.ts`

**1. Extensão da interface Chunk:**
```typescript
interface Chunk {
  source_type: "article" | "video" | "resin" | "parameter" | "company_kb" | "catalog_product";
  // ... resto igual
}
```

**2. Nova stage após o bloco `external-kb` (linha ~622):**

```typescript
// ── 6. CATALOG PRODUCTS (system_a_catalog) ──────────────────────
const { data: catalogProducts } = await supabase
  .from("system_a_catalog")
  .select("id, name, category, product_category, product_subcategory, description, cta_1_url, slug, extra_data, keywords, meta_description")
  .eq("active", true)
  .eq("approved", true)
  .eq("category", "product");

for (const p of catalogProducts || []) {
  const productUrl = p.cta_1_url || (p.slug ? `https://loja.smartdent.com.br/${p.slug}` : null);
  const categoryLabel = [p.product_category, p.product_subcategory].filter(Boolean).join(" > ");

  // Chunk 1: Description (principal)
  if (p.description && p.description.length > 50) {
    chunks.push({
      source_type: "catalog_product",
      chunk_text: [
        `${p.name}${categoryLabel ? " — " + categoryLabel : ""}`,
        p.meta_description || "",
        p.description.slice(0, 1200),
      ].filter(Boolean).join(" | "),
      metadata: {
        title: p.name,
        category: categoryLabel,
        url: productUrl,
        product_id: p.id,
        chunk_type: "description",
      },
    });
  }

  // Chunk 2: Benefits
  const benefits: string[] = p.extra_data?.benefits || [];
  if (benefits.length > 0) {
    chunks.push({
      source_type: "catalog_product",
      chunk_text: [
        `${p.name} — Diferenciais e Benefícios`,
        benefits.map(b => `• ${b}`).join(" | ").slice(0, 1000),
      ].filter(Boolean).join(" | "),
      metadata: {
        title: `${p.name} — Benefícios`,
        category: categoryLabel,
        url: productUrl,
        product_id: p.id,
        chunk_type: "benefits",
      },
    });
  }

  // Chunk 3: FAQs
  const faqs: Array<{question: string; answer: string}> = p.extra_data?.faq || [];
  if (faqs.length > 0) {
    const faqText = faqs
      .slice(0, 5) // max 5 FAQs por chunk
      .map(f => `P: ${f.question.replace(/<[^>]+>/g, "")} R: ${f.answer.replace(/<[^>]+>/g, "").slice(0, 200)}`)
      .join(" | ");
    chunks.push({
      source_type: "catalog_product",
      chunk_text: [
        `${p.name} — Perguntas Frequentes`,
        faqText,
      ].filter(Boolean).join(" | ").slice(0, 1500),
      metadata: {
        title: `${p.name} — FAQ`,
        category: categoryLabel,
        url: productUrl,
        product_id: p.id,
        chunk_type: "faq",
      },
    });
  }
}
```

**3. Log atualizado:**
```typescript
console.log(`Mode: ${mode} | Total: ${chunks.length} | company_kb: ${externalChunks.length} | catalog_products: ${(catalogProducts||[]).length}`);
```

## O que muda na L.I.A. após a reindexação

| Pergunta | Antes | Depois |
|---|---|---|
| "O que tem de especial na RayShape Edge Mini?" | Resposta genérica baseada em artigos | "Nivelamento automático, ShapeWare 2.0 com IA, coroa em 17 min, faceta em 12 min..." |
| "A Edge Mini é compatível com quais formatos?" | "Não sei" | "STL e OBJ — padrão na odontologia digital" |
| "Quais são os benefícios da resina Vitality?" | Parcial (base nos artigos) | Descrição completa + lista de benefits + FAQs |
| "A SmartDent vende pós-cura?" | Sim, com info limitada | Asiga Cure e Pionext UV-02 com detalhes técnicos |
| "Quais impressoras 3D vocês têm?" | Vaga | Lista com diferenciais de cada equipamento |

## Impacto no RAG

```
ANTES (1.073 chunks):           DEPOIS (~1.400 chunks):
├── article: 307               ├── article: 307
├── video: 443                 ├── video: 443
├── parameter: 305             ├── parameter: 305
├── resin: 18                  ├── resin: 18
└── company_kb: 23             ├── company_kb: 23
                               └── catalog_product: ~328 (NOVO)
```

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/index-embeddings/index.ts` | + `"catalog_product"` no tipo `source_type` + nova stage que lê `system_a_catalog` e gera chunks de descrição, benefits e FAQ por produto |

Nenhuma migração SQL. Nenhuma mudança no frontend. Nenhuma nova edge function.

Após o deploy, o admin deve executar **"Reindexar Tudo"** no painel para gerar os ~328 novos chunks. A L.I.A. começa a responder sobre produtos imediatamente após a reindexação.
