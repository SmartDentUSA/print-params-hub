## Diagnóstico

Investiguei `supabase/functions/_shared/lia-rag.ts` e os dados reais em `system_a_catalog` / `resins`. Encontrei 3 causas independentes para os links quebrados/errados:

### 1. URLs com sujeira no banco (trailing dash, espaços, HTML)
Vários `cta_1_url` e `system_a_product_url` terminam com `-` ou `/`, o que dá 404 na loja:
- `https://loja.smartdent.com.br/resina-smart-print-try-in-calcinavel-`
- `https://loja.smartdent.com.br/resina-smart-print-clear-guide-`
- `https://loja.smartdent.com.br/resina-smart-print-temp-`

A LIA repassa o valor cru e o link quebra.

### 2. URL "pública" do catálogo confundindo o modelo
Para produtos do catálogo, hoje emitimos **dois** links no contexto que vai ao LLM:

```
[CATALOG_PRODUCT] ... | URL: https://parametros.smartdent.com.br/produtos/<slug> | COMPRA: https://loja.smartdent.com.br/<slug>
```

O LLM frequentemente envia o primeiro (parametros), que é a página de parâmetros do produto — não a loja. O usuário pede "link da loja" e recebe `parametros.smartdent.com.br/...`. Errado pelo intent comercial.

### 3. Rota singular inexistente para protocolo de resina
Em `searchProcessingInstructions` (lia-rag.ts:352) montamos:

```
url_publica: `${siteBaseUrl}/resina/${slug}`   ← singular, rota não existe
```

A rota real em `src/App.tsx` é `/resinas/:slug` (plural). Resultado: link 404.

---

## Plano de Correção

Tudo em `supabase/functions/_shared/lia-rag.ts` (mais um helper). Sem mudanças de UI, schema ou comportamento de chat.

### Passo 1 — Helper `sanitizeShopUrl()`
Adicionar função pura no topo de `lia-rag.ts`:
- Remove tags HTML residuais
- `trim()` e remove espaços internos
- Remove caracteres finais inválidos: `-`, `/`, `.`, `,`, `;`, `:` (loop até estabilizar, preservando `://`)
- Retorna `null` se o resultado ficar vazio ou sem `http`

Usar em todo lugar que emite `cta_1_url` / `system_a_product_url` / `url_publica` apontando para loja.

### Passo 2 — `searchCatalogProducts` (linha ~325)
Trocar metadata para:
- `url_publica`: usa `sanitizeShopUrl(p.cta_1_url)` como primário. Se ausente, cai para `${siteBaseUrl}/produtos/${slug}`.
- Remover o campo `cta_1_url` separado do metadata para não duplicar no prompt.

Resultado no contexto: uma única `URL: https://loja.smartdent.com.br/<slug-limpo>`.

### Passo 3 — `searchProcessingInstructions` (linha ~352)
- Corrigir `/resina/` → `/resinas/` (plural, rota real).
- Preferir `sanitizeShopUrl(r.cta_1_url)` como `url_publica`; queda para `${siteBaseUrl}/resinas/${slug}` se não houver.
- Remover `cta_1_url` separado do metadata.

### Passo 4 — Bloco `resin` no RAG vetorial (linha ~194 e ~237)
- Aplicar `sanitizeShopUrl` em qualquer URL de resina exposta.
- Manter `/resinas/${slug}` (já está plural correto aqui).

### Passo 5 — `buildStructuredContext` (linha ~562)
Como produtos agora só têm `url_publica`, a linha `| COMPRA: ${cta_1_url}` deixa de existir naturalmente. Confirmar que nenhum outro `source_type` quebre por causa disso.

### Passo 6 — Teste unitário rápido
Adicionar `supabase/functions/_shared/lia-rag_test.ts` com casos para `sanitizeShopUrl`:
- `https://loja.smartdent.com.br/foo-` → `https://loja.smartdent.com.br/foo`
- `  https://x.com/y/  ` → `https://x.com/y`
- `<a>https://x.com/z</a>` → `https://x.com/z`
- `null` / `""` / `"abc"` → `null`

Rodar via `supabase--test_edge_functions`.

### Passo 7 — Deploy
Redeploy de `dra-lia` e `dra-lia-whatsapp` (ambas importam `lia-rag.ts`).

---

## Fora de escopo (proponho como follow-up se quiser)
- **Limpeza no banco** dos `cta_1_url`/`system_a_product_url` com trailing dash (migration + UPDATE com regex). O sanitizador runtime já resolve, mas a limpeza no banco evita o problema em outros consumidores (admin, cards, auto-inject).
- Auditoria do importador que está gravando URLs com `-` no final (provável `LojaIntegradaImporter` ou `PublicAPIProductImporter`).

Confirma que posso prosseguir? Se quiser, já incluo a migration de limpeza no mesmo passo.