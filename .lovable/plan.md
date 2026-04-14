

## Problema: Documentos técnicos não aparecem na página de produto

### Diagnóstico (3 problemas encontrados)

**1. Falta seção de renderização no JSX**
A query busca `catalog_documents` corretamente, mas **não existe nenhum bloco de UI** que renderize os documentos na página. O JSX mostra benefits, features, variations e FAQs — mas pula documentos completamente.

**2. Falta filtro `active` nos documentos**
A query join não filtra `catalog_documents.active = true`, então documentos inativos também viriam.

**3. Slugs são URLs completas (problema separado)**
Os slugs dos produtos no banco são URLs completas (`https://loja.smartdent.com.br/atos-block-...`) em vez de slugs limpos. Isso significa que a rota `/produto/:slug` provavelmente nunca faz match. Este é um problema pré-existente que pode precisar de correção separada.

---

### Correção em `src/pages/ProductPage.tsx`

**A. Adicionar filtro `active` na query (linha ~54)**
Adicionar `.eq('catalog_documents.active', true)` após o `.eq("approved", true)`.

**B. Adicionar seção de documentos no JSX (após variations, antes de FAQs ~linha 299)**
Renderizar os documentos como cards com ícone de PDF, nome, descrição e link para download/visualização:

```tsx
{(product as any).documents && (product as any).documents.length > 0 && (
  <Card className="mb-8">
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <FileText className="w-5 h-5" />
        Documentos Técnicos
      </CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        {(product as any).documents.map((doc: any) => (
          <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted transition-colors">
            <FileText className="w-8 h-8 text-red-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{doc.document_name}</p>
              {doc.document_description && (
                <p className="text-sm text-muted-foreground">{doc.document_description}</p>
              )}
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground shrink-0" />
          </a>
        ))}
      </div>
    </CardContent>
  </Card>
)}
```

### Arquivo alterado
- `src/pages/ProductPage.tsx` — adicionar filtro active + seção de documentos no JSX

### Resultado
Os PDFs vinculados a cada produto aparecerão como cards clicáveis na página pública do produto, com ícone, nome e link direto para visualização.

