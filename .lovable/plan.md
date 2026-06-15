## Escopo
Três correções pontuais em arquivos estáticos. Nada além disso.

### 1. `public/robots.txt`
Substituir linha 58:
- De: `Sitemap: https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/video-sitemap`
- Para: `Sitemap: https://parametros.smartdent.com.br/video-sitemap.xml`

Resto do arquivo intacto.

### 2. `vercel.json` — adicionar rewrites faltantes
Auditoria do estado atual vs. lista solicitada:

| Path | Status atual |
|---|---|
| `/llms.txt` | ✅ já existe (→ EF `llms-txt`) |
| `/llms-full.txt` | ✅ já existe (→ EF `llms-full-txt`) |
| `/sitemap.xml` | ✅ já existe (→ EF `generate-sitemap`) |
| `/sitemap-conhecimento-pt.xml` | ✅ já existe |
| `/sitemap-conhecimento-en.xml` | ✅ já existe |
| `/sitemap-conhecimento-es.xml` | ✅ já existe |
| `/sitemap-documentos.xml` | ✅ já existe |
| `/video-sitemap.xml` | ✅ já existe (→ `/api/video-sitemap`, mantém como está — não remover) |
| `/rss.xml` | ✅ já existe |
| `/sitemap-index.xml` | ❌ **adicionar** → EF `sitemap-index` |
| `/knowledge-graph` | ❌ **adicionar** → EF `knowledge-graph` |

Adicionar apenas os dois rewrites faltantes, antes do catch-all SPA. Nenhuma outra alteração.

```json
{ "source": "/sitemap-index.xml", "destination": "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/sitemap-index" },
{ "source": "/knowledge-graph",  "destination": "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/knowledge-graph" }
```

### 3. `index.html` — favicons + tag llms
- Remover os 7 `<link rel="icon">` / `apple-touch-icon` / `shortcut icon` atuais (linhas que apontam para `/favicon*.png|.ico`).
- Inserir no lugar os 6 `<link>` apontando para Supabase Storage `catalog-images/favicons/...` (conforme especificado).
- Adicionar `<link rel="llms" href="/llms.txt">` no `<head>`.
- Manter `<link rel="manifest">`, theme-color e demais tags PWA intactas.

## Observações
- As EFs `sitemap-index` e `knowledge-graph` precisam existir/estar deployadas no Supabase para os novos rewrites responderem 200. Posso verificar isso após a aprovação, ou seguir cegamente conforme pedido?
- Favicons em CDN externa adicionam um round-trip vs. assets locais — confirmado que é intencional?
