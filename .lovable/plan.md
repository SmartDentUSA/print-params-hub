
## Diagnóstico: Links de Produtos Quebrados na Dra. L.I.A.

### 3 Causas Raízes Identificadas

---

### Causa 1 — CRÍTICA: Resinas NÃO estão indexadas no RAG

A tabela `agent_embeddings` tem atualmente:
- **441 chunks** de vídeo
- **304 chunks** de artigo  
- **0 chunks** de resina ← o problema principal

Isso significa que quando a Dra. L.I.A. faz busca vetorial (RAG), ela **nunca encontra resinas**. A indexação anterior (`mode=full`) processou apenas artigos e vídeos — as resinas falharam silenciosamente (provavelmente por timeout ou erro de embedding).

---

### Causa 2 — Campo `cta_1_url` está NULL para a maioria das resinas

O banco de dados confirma: as resinas Smart Dent têm `cta_1_url = NULL`, mas possuem o campo `system_a_product_url` preenchido com as URLs corretas da loja:

```
system_a_product_url: https://loja.smartdent.com.br/resina-smart-print-clear-guide-
system_a_product_url: https://loja.smartdent.com.br/resina-smart-print-bio-denture-translucida
system_a_product_url: https://loja.smartdent.com.br/resina-3d-smart-print-bio-denture
```

O indexador busca apenas `cta_1_url` (linha 190 do `index-embeddings/index.ts`), ignorando completamente `system_a_product_url`. Logo, mesmo quando as resinas fossem indexadas, o metadata `cta_1_url` ficaria `null` e **nenhum link seria enviado para a IA**.

---

### Causa 3 — `url_publica` com caminho errado + `title` ausente

Linha 213 do indexador constrói a URL como `/resinas/${r.slug}` (com "s"), mas a rota do app é `/resina/${slug}` (sem "s") — levando a 404. Além disso, o metadata de resinas usa o campo `name` em vez de `title`, criando inconsistência com o padrão dos outros chunks.

---

### As 4 Correções Necessárias

**Correção 1 — `index-embeddings/index.ts` linha 190:** Adicionar `system_a_product_url` ao SELECT das resinas.

```typescript
// ANTES
.select("id, name, manufacturer, description, processing_instructions, slug, cta_1_url, keywords")

// DEPOIS
.select("id, name, manufacturer, description, processing_instructions, slug, cta_1_url, system_a_product_url, keywords")
```

**Correção 2 — `index-embeddings/index.ts` linhas 208-214:** Usar `system_a_product_url` como fallback do link de compra e corrigir os campos do metadata:

```typescript
// ANTES
metadata: {
  name: r.name,
  manufacturer: r.manufacturer,
  slug: r.slug,
  cta_1_url: r.cta_1_url,                        // null para maioria das resinas
  url_publica: r.slug ? `/resinas/${r.slug}` : null, // URL com "s" = 404
}

// DEPOIS
metadata: {
  title: `${r.manufacturer} ${r.name}`,           // padronizado com artigos/vídeos
  name: r.name,
  manufacturer: r.manufacturer,
  slug: r.slug,
  cta_1_url: r.cta_1_url || r.system_a_product_url, // fallback para URL da loja
  url_publica: r.slug ? `/resina/${r.slug}` : null,  // sem "s" = rota correta
}
```

**Correção 3 — `dra-lia/index.ts` linha 697:** O caminho `searchProcessingInstructions` já usa `/resina/` corretamente — nenhuma mudança necessária aqui.

**Correção 4 — `dra-lia/index.ts` linha 1232:** Corrigir o link do WhatsApp no system prompt (já identificado anteriormente):

```
// ANTES
https://api.whatsapp.com/send/?phone=551634194735

// DEPOIS
https://wa.me/551634194735?text=Ol%C3%A1%2C+preciso+de+ajuda+t%C3%A9cnica!
```

---

### Resumo das Alterações

| Arquivo | Linha | Mudança |
|---|---|---|
| `index-embeddings/index.ts` | 190 | Adicionar `system_a_product_url` ao SELECT |
| `index-embeddings/index.ts` | 208-214 | Metadata: `title` padronizado + fallback para `system_a_product_url` + corrigir `/resina/` |
| `dra-lia/index.ts` | 1232 | Corrigir link WhatsApp para `wa.me` com mensagem |

### Sequência obrigatória após o deploy

1. Deploy automático das funções
2. **Re-indexação completa** (mode=full) — obrigatória para criar os chunks de resinas com os dados corretos
3. Confirmar que `agent_embeddings` passa de **745 para ~763** registros (745 + 18 resinas)
4. Testar a Dra. L.I.A. com "Me fale sobre a resina Smart Print Bio Hybrid" e confirmar que aparece o link da loja

Nenhuma migração de banco. O campo `system_a_product_url` já existe na tabela `resins`.
