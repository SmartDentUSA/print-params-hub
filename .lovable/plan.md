

## Plano: Nova Categoria G - Catálogo de Produtos + Rota /support-resources

### Objetivo
Criar uma nova categoria "G - Catálogo de Produtos" na Base de Conhecimento, com uma página dedicada em `/support-resources` que exibe cards de resinas e produtos organizados por categorias, com botões de ação (Loja, FDS, IFU).

### Arquitetura

A categoria G não será uma categoria de artigos como as demais (A-F). Será uma **página especial** que puxa dados diretamente das tabelas `system_a_catalog`, `resins`, `catalog_documents` e `resin_documents`.

---

### 1. Migração de banco — Inserir categoria G

```sql
INSERT INTO knowledge_categories (letter, name, enabled)
VALUES ('G', 'Catálogo de Produtos', true);
```

### 2. Nova página `src/pages/SupportResources.tsx`

Página pública que:
- Busca todos os produtos ativos/aprovados de `system_a_catalog` (com `product_category IS NOT NULL`) e todas as resinas ativas
- Para cada produto/resina, busca documentos associados (`catalog_documents` / `resin_documents`) para gerar botões FDS e IFU
- Agrupa por `product_category` (ex: RESINAS 3D, IMPRESSÃO 3D, SCANNERS 3D, etc.)
- Renderiza em grid responsivo: **4 colunas desktop, 2 colunas mobile**

**Cada card terá:**
- Foto do produto (igual aos cards da parametrização)
- Nome do produto
- Botões de ação: **Loja** (link externo cta_1_url), **FDS** (link para PDF se existir), **IFU** (link para PDF se existir)
- Visual inspirado na imagem de referência enviada

### 3. Rotas em `src/App.tsx`

```
/support-resources → <SupportResources />
```

Também redirecionar a pill "G" da Base de Conhecimento para `/support-resources` em vez de abrir como categoria de artigos normal.

### 4. Atualização do `KnowledgeBase.tsx`

Quando o usuário clicar na pill da categoria G, redirecionar para `/support-resources` em vez de tentar carregar artigos.

### 5. Locales

- `pt.json`: `"category_g": "Catálogo de Produtos"`
- `en.json`: `"category_g": "Product Catalog"`
- `es.json`: `"category_g": "Catálogo de Productos"`

### 6. SEO

- Helmet com titulo "Catálogo de Produtos | Smart Dent"
- Meta description para indexação
- Header + Footer padrão do site

---

### Arquivos afetados
- **Novo**: `src/pages/SupportResources.tsx`
- **Editar**: `src/App.tsx` (nova rota)
- **Editar**: `src/pages/KnowledgeBase.tsx` ou `KnowledgeCategoryPills.tsx` (redirect para G)
- **Editar**: `src/locales/pt.json`, `en.json`, `es.json`
- **Migração SQL**: inserir categoria G

