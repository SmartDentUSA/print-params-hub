

## Problema identificado

Os documentos inseridos no catálogo estão sendo salvos na tabela `catalog_documents`, mas a página de produto (`ProductPage.tsx`) busca documentos da tabela `resin_documents`. Por isso, os documentos nunca aparecem na UI pública.

### Dados confirmados
- Existem 2 documentos ativos na tabela `catalog_documents`
- A tabela `resin_documents` é uma tabela separada (para resinas, não para produtos do catálogo)
- O `ProductPage.tsx` linha 54 faz: `documents:resin_documents(...)` -- tabela errada

### Correção

**Arquivo: `src/pages/ProductPage.tsx`**

Alterar a query de busca de documentos de `resin_documents` para `catalog_documents`:

```typescript
// DE:
documents:resin_documents(
  id, document_name, document_description, file_url, file_name, file_size, updated_at
)

// PARA:
documents:catalog_documents(
  id, document_name, document_description, file_url, file_name, file_size, updated_at
)
```

Adicionar filtro `.eq('catalog_documents.active', true)` para mostrar apenas documentos ativos.

Verificar também se a seção de renderização de documentos no JSX do `ProductPage` está presente e funcional (linhas 200+).

### Resultado
Os documentos inseridos via admin aparecerão corretamente na página pública do produto.

