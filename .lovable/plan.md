

## Problema: LIA gera links com dominio inventado (`seudominio.com.br`)

### Diagnostico

O artigo **"Comparativo entre resinas"** existe no banco com `category_letter: C` e `slug: comparativo-resinas`. A URL correta e `https://parametros.smartdent.com.br/base-conhecimento/c/comparativo-resinas`.

O que acontece:
1. O codigo constroi `url_publica` como caminho relativo: `/base-conhecimento/c/comparativo-resinas`
2. Na linha 3313, esse caminho e injetado no contexto da IA como: `| URL: /base-conhecimento/c/comparativo-resinas`
3. O modelo Gemini nao sabe qual e o dominio real, entao **inventa** `seudominio.com.br` (ou qualquer outro dominio generico)
4. Nao existe nenhuma regra no system prompt instruindo a IA sobre qual dominio usar

### Correcao — 1 arquivo, 2 acoes

#### 1. Prefixar todas as `url_publica` e `url_interna` com o dominio absoluto

**Arquivo**: `supabase/functions/dra-lia/index.ts`

Criar constante no topo do arquivo:
```typescript
const SITE_BASE_URL = "https://parametros.smartdent.com.br";
```

Prefixar em **7 locais** onde caminhos relativos sao construidos:

| Linha | Codigo atual | Correcao |
|-------|-------------|----------|
| 339 | `` `/base-conhecimento/${letter}/${a.slug}` `` | `` `${SITE_BASE_URL}/base-conhecimento/${letter}/${a.slug}` `` |
| 1487 | `` `/base-conhecimento/${letter}/${a.slug}` `` | `` `${SITE_BASE_URL}/base-conhecimento/${letter}/${a.slug}` `` |
| 1629 | `` `/produtos/${p.slug}` `` | `` `${SITE_BASE_URL}/produtos/${p.slug}` `` |
| 1698 | `` `/resina/${r.slug}` `` | `` `${SITE_BASE_URL}/resina/${r.slug}` `` |
| 1771 | `` `/${brand.slug}/${model.slug}` `` | `` `${SITE_BASE_URL}/${brand.slug}/${model.slug}` `` |
| 1847 | `` `/base-conhecimento/${a.category_letter}/${a.slug}` `` | `` `${SITE_BASE_URL}/base-conhecimento/${a.category_letter}/${a.slug}` `` |
| 1926 | `` `/base-conhecimento/${contentInfo.category_letter}/${contentInfo.slug}` `` | `` `${SITE_BASE_URL}/base-conhecimento/${contentInfo.category_letter}/${contentInfo.slug}` `` |

#### 2. Adicionar regra no system prompt sobre links

Adicionar instrucao explicita no system prompt (bloco de regras), algo como:

```
REGRA LINKS: Quando referenciar artigos, produtos ou resinas da base de conhecimento,
use EXATAMENTE a URL completa fornecida no campo URL dos dados.
NUNCA invente dominios. NUNCA use "seudominio.com.br" ou qualquer outro dominio ficticio.
Se a URL estiver no formato https://parametros.smartdent.com.br/..., use-a tal qual.
```

### Resumo

| # | Arquivo | Acao |
|---|---------|------|
| 1 | `supabase/functions/dra-lia/index.ts` | Criar `SITE_BASE_URL`, prefixar 7 locais com dominio absoluto, adicionar regra de links no prompt |

### Resultado esperado

Todos os links injetados no contexto RAG ja chegarao ao modelo como URLs absolutas (`https://parametros.smartdent.com.br/base-conhecimento/c/comparativo-resinas`), eliminando qualquer possibilidade de o modelo inventar o dominio.

