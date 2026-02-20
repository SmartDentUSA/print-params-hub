
# Atualizar Painel RAG: 6 Fontes + Reindexação Seletiva por Categoria

## O que está desatualizado

O painel "Ações de Indexação" e a seção de "Distribuição por Tipo de Fonte" foram escritos quando o RAG tinha apenas 4 fontes. Após as últimas implementações, o RAG agora indexa **6 fontes**, mas a UI não reflete isso:

**Texto desatualizado (linha 1163):**
> "A Indexação Completa apaga todos os embeddings e re-indexa tudo (**artigos, vídeos, resinas, parâmetros**)."

**Distribuição por tipo desatualizada (linhas 1133–1150):** array hardcoded com apenas 4 entradas — `article`, `video`, `resin`, `parameter` — os chunks de `company_kb` (23 chunks) e `catalog_product` (~321 chunks) existem no banco mas não aparecem nas barras de progresso.

## Mudanças a implementar

### 1. `src/components/AdminDraLIAStats.tsx` — 4 ajustes pontuais

**A. Distribuição por tipo** (linha 1133): Substituir o array de 4 itens por 6, adicionando:

| source_type | Label | Ícone existente | Cor |
|---|---|---|---|
| `company_kb` | Empresa & Parcerias | `Building2` (importar) | `bg-violet-500` |
| `catalog_product` | Produtos Catálogo | `ShoppingBag` (importar) | `bg-amber-500` |

**B. Texto descritivo** (linha 1163): Atualizar para mencionar todas as 6 fontes:
> "A **Indexação Completa** apaga todos os embeddings e re-indexa tudo (artigos, vídeos, resinas, parâmetros, **empresa & parcerias, produtos do catálogo**). A **Incremental** só indexa conteúdo novo ou modificado."

**C. Nova seção: Reindexação Seletiva por Categoria** — inserir acima dos botões globais um grid de 6 cards compactos (um por fonte), cada um mostrando o count atual de chunks e um botão "Reindexar apenas esta fonte":

```
┌─────────────────────────────────────────────────────────────────────┐
│  Reindexar por Categoria (apaga e recria apenas os chunks da fonte) │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐    │
│  │ 📄 Artigos       │ │ 🎥 Vídeos        │ │ 🧪 Resinas       │    │
│  │ 307 chunks       │ │ 443 chunks       │ │ 18 chunks        │    │
│  │ [↺ Reindexar]    │ │ [↺ Reindexar]    │ │ [↺ Reindexar]    │    │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘    │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐    │
│  │ ⚙️ Parâmetros    │ │ 🏢 Empresa       │ │ 🛍️ Produtos      │    │
│  │ 305 chunks       │ │ 23 chunks        │ │ 321 chunks       │    │
│  │ [↺ Reindexar]    │ │ [↺ Reindexar]    │ │ [↺ Reindexar]    │    │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

**D. Handler `handleIndexingStage(stage)`** — nova função no componente que chama:
```
POST /index-embeddings?mode=full&stage=${stage}
```

### 2. `supabase/functions/index-embeddings/index.ts` — suporte ao parâmetro `?stage=`

Adicionar lógica de stage seletivo logo após a leitura do `mode`:

```typescript
const stage = url.searchParams.get("stage") || "all";

const stageToSourceType: Record<string, string> = {
  articles: "article",
  videos: "video",
  resins: "resin",
  parameters: "parameter",
  company_kb: "company_kb",
  catalog_products: "catalog_product",
};

// Se stage específico + mode full: apaga apenas os chunks daquela fonte
if (mode === "full" && stage !== "all") {
  const sourceType = stageToSourceType[stage];
  if (sourceType) {
    await supabase
      .from("agent_embeddings")
      .delete()
      .eq("source_type", sourceType);
  }
} else if (mode === "full" && stage === "all") {
  // comportamento atual: apaga tudo
  await supabase.from("agent_embeddings").delete().neq("id", "00000000-...");
}
```

Cada bloco de indexação dos 6 estágios ganha um `if`:
```typescript
if (stage === "all" || stage === "articles") {
  // bloco artigos existente
}
if (stage === "all" || stage === "videos") {
  // bloco vídeos existente
}
// ... e assim por diante para resins, parameters, company_kb, catalog_products
```

## Arquivos modificados

| Arquivo | Mudanças |
|---|---|
| `src/components/AdminDraLIAStats.tsx` | + 2 ícones importados (`Building2`, `ShoppingBag`) + array de distribuição com 6 itens + texto descritivo atualizado + seção de reindexação seletiva + handler `handleIndexingStage` |
| `supabase/functions/index-embeddings/index.ts` | + parse do parâmetro `?stage=` + delete seletivo por `source_type` + condicionais `if (stage === "all" || stage === "xxx")` nos 6 blocos |

Nenhuma migração SQL. Apenas UI + edge function. Deploy automático.

## Resultado esperado

Após clicar em "Indexação Completa", o texto e o gráfico refletirão corretamente as 6 fontes (incluindo 321 chunks de produtos e 23 de empresa). Os botões seletivos permitirão reindexar apenas os produtos quando o catálogo for atualizado, sem precisar re-embedar os 1.000+ chunks de artigos e vídeos.
