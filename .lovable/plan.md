
# Adicionar AdminApostilaImporter na aba "Docs Sistema"

## O que fazer

Inserir o componente `AdminApostilaImporter` na aba **"Docs Sistema"** do painel admin (`/admin`), posicionado **antes** do `<AdminDocumentsList />`.

## Arquivo a modificar

**`src/pages/AdminViewSecure.tsx`**

### Mudança 1 — Importar o componente (linha 27, após as outras importações)

```typescript
import { AdminApostilaImporter } from "@/components/AdminApostilaImporter";
```

### Mudança 2 — Inserir na aba "documents" (linha 254–256)

```typescript
// Antes:
<TabsContent value="documents" className="space-y-6">
  <AdminDocumentsList />
</TabsContent>

// Depois:
<TabsContent value="documents" className="space-y-6">
  <AdminApostilaImporter />
  <AdminDocumentsList />
</TabsContent>
```

## Resultado visual esperado

Ao entrar na aba **Docs Sistema**, o usuário verá:
1. **Importador da Apostila JSON** (novo) — com upload de arquivo, os 3 botões de ação (Importar Catálogo, Enriquecer Resinas, Indexar Embeddings) e feedback de progresso
2. **📄 Documentos do Sistema** (existente) — listagem de documentos como antes

## Seção Técnica

- Nenhuma nova edge function necessária — o componente já existe e foi criado no deploy anterior.
- Nenhuma mudança de banco, nenhuma migração.
- Apenas 2 linhas alteradas: 1 import + 1 JSX insertion.
