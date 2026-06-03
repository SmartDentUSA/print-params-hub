## Diagnóstico do erro do GSC

O GSC mostra:
- Tipo: **Desconhecido**
- Última leitura: **19/mai/2026** (anterior aos fixes recentes)
- Status: **Não foi possível buscar o sitemap**

Testando agora em produção (`https://parametros.smartdent.com.br/sitemap.xml`):

| Item | Estado | Observação |
|---|---|---|
| HTTP status | 200 OK | OK |
| Tamanho | 372 KB | OK |
| Conteúdo XML válido | Sim | OK |
| `robots.txt` lista sitemaps | Sim (5 URLs) | OK |
| Content-Type | **DUPLICADO** (`text/xml` + `application/xml`) | Problema |
| `/video-sitemap.xml` | **`text/plain`** | Problema |
| `/sitemap-laudos.xml`, `-resinas`, `-artigos`, `-parametros` | 200 com Content-Type duplicado | Problema |

### Causas raiz

1. **Cabeçalho Content-Type duplicado**: a edge function `generate-sitemap` já emite `application/xml`, e o nginx upstream também injeta `text/xml`. Alguns parsers (incluindo o do GSC) leem o primeiro header (`text/xml`) — ainda é XML válido, mas em combinação com a leitura antiga gera erro.

2. **`/video-sitemap.xml`** responde `text/plain` apesar do header definido no `vercel.json`. O rewrite vai para `/api/video-sitemap` (Vercel function) e essa função seta o próprio Content-Type, sobrescrevendo o header do `vercel.json`.

3. **Sitemaps órfãos no vercel.json**: o arquivo declara headers para `/sitemap-conhecimento-:lang.xml` e `/sitemap-documentos.xml` (que não existem no `robots.txt`), mas **não declara** os 4 sitemaps reais listados no `robots.txt` (`-laudos`, `-resinas`, `-artigos`, `-parametros`). Isso significa que esses sitemaps reais não passam por nenhum rewrite/header da Vercel — devem estar sendo capturados pelo fallback de bot ou pelo `seo-proxy`.

4. **Última leitura 19/mai**: anterior aos fixes de Content-Type e dos novos rewrites. O próprio botão "Enviar novamente" no GSC normalmente resolve, mas vale corrigir os 3 itens acima antes.

## Plano de correção

### 1. Edge function `generate-sitemap` — remover duplicação de Content-Type
Garantir que a função retorne **apenas** `application/xml; charset=utf-8` e nenhum `text/xml` adicional (verificar se algum middleware/CORS helper está injetando o segundo header). Aplicar o mesmo a `generate-knowledge-sitemap`, `-en`, `-es` e `generate-documents-sitemap`.

### 2. Função `/api/video-sitemap` — corrigir Content-Type
Forçar dentro do handler:
```ts
res.setHeader('Content-Type', 'application/xml; charset=utf-8')
```
(Os headers do `vercel.json` não sobrescrevem o que a função emite.)

### 3. `vercel.json` — alinhar com o que existe de verdade

a) **Adicionar rewrites + headers** para os 4 sitemaps reais listados no `robots.txt`:
- `/sitemap-laudos.xml`
- `/sitemap-resinas.xml`
- `/sitemap-artigos.xml`
- `/sitemap-parametros.xml`

Direcioná-los para a(s) edge function(s) que efetivamente os geram (precisa investigar — provavelmente uma única função paramétrica) e fixar `Content-Type: application/xml; charset=utf-8`.

b) **Remover (ou manter, mas não usar)** os headers órfãos de `/sitemap-conhecimento-:lang.xml` e `/sitemap-documentos.xml` se essas URLs realmente não forem servidas.

c) **Adicionar header global** para qualquer `/sitemap*.xml` como fallback, garantindo Content-Type correto.

### 4. Validação pós-deploy
Após o redeploy:
```bash
curl -sI https://parametros.smartdent.com.br/sitemap.xml
# Esperado: 1 único Content-Type: application/xml
```
Depois, no GSC, clicar em **"Enviar novamente"** no sitemap. Em até 24h o status deve mudar para "Sucesso" e Tipo "Índice de sitemap" ou "Sitemap".

### 5. Bônus opcional — converter em sitemap index
Como hoje existem 5 sitemaps independentes listados separadamente no `robots.txt`, faz sentido criar `/sitemap.xml` como um **sitemap index** (`<sitemapindex>`) referenciando os outros 4. Isso simplifica a leitura pelo Google e centraliza o monitoramento numa única entrada do GSC. Posso implementar se quiser.

## O que NÃO mudar
- Conteúdo dos sitemaps (URLs, prioridades, lastmod) — já estão corretos.
- `robots.txt`.
- SSR/`seo-proxy`.
- Edge functions de SEO já corrigidas anteriormente (JSON-LD, schema, hreflang).

Posso prosseguir com os passos 1–4 (e o 5 se quiser o sitemap index)?