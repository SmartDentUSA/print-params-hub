## Ajustes no `vercel.json`

Aplicar duas correções para garantir que TODAS as rotas funcionem no deploy Vercel (`print-params-hub.vercel.app` e futuro `parametros.smartdent.com.br`).

### 1. SPA fallback genérico

Adicionar no final do array `rewrites` (depois do `/f/:path*` e antes do bot-detection):

```json
{
  "source": "/((?!api/|.*\\.[a-zA-Z0-9]+$).*)",
  "destination": "/index.html"
}
```

Captura todas as rotas SPA não mapeadas: `/base-conhecimento/*`, `/support-resources`, `/admin`, `/produtos/*`, `/social/*`, `/about`, `/auth`, etc. Exclui requests para `/api/*` e arquivos com extensão (`.js`, `.css`, `.png`, `.xml`, `.txt`...).

### 2. Content-Type XML para sitemaps

Adicionar no array `headers`:

```json
{
  "source": "/sitemap-conhecimento-:lang.xml",
  "headers": [{ "key": "Content-Type", "value": "application/xml; charset=utf-8" }]
},
{
  "source": "/sitemap-documentos.xml",
  "headers": [{ "key": "Content-Type", "value": "application/xml; charset=utf-8" }]
}
```

Hoje os sitemaps de conhecimento e documentos são servidos como `text/plain`, o que prejudica parsing por Googlebot.

### Ordem de execução

1. Editar `vercel.json` com os dois ajustes acima
2. Commit automático → Vercel redeploy (~1 min)
3. Re-rodar bateria de curl em todas as rotas testadas anteriormente para confirmar 20/20 200
4. Confirmar headers XML corretos nos sitemaps

---

## Sobre compartilhar URLs de formulários

**Resposta direta: SIM, pode compartilhar o URL Vercel** (`https://print-params-hub.vercel.app/f/{slug}`) enquanto o DNS de `parametros.smartdent.com.br` não estiver apontado para a Vercel.

Recomendação:

- **Curto prazo (antes do DNS)**: use o domínio Vercel diretamente — `print-params-hub.vercel.app/f/ioconnect`. É estável (20/20 200 nos testes) e funciona em paid traffic, QR codes, links no WhatsApp.
- **Longo prazo (após DNS)**: assim que apontarmos `parametros.smartdent.com.br` para `cname.vercel-dns.com`, o mesmo URL funcionará em ambos os domínios. **Não quebra nada compartilhar agora com domínio Vercel** — o roteamento `/f/:slug` é idêntico nos dois.

**Atenção (importante para tracking)**:
- Se você já tem campanhas Meta/Google Ads usando `parametros.smartdent.com.br/f/...`, mantenha esses URLs e migre o DNS antes — eles continuarão funcionando após a mudança.
- Se for criar campanhas novas agora, pode usar `print-params-hub.vercel.app/f/...` sem problema; depois do DNS, ambos resolvem para o mesmo destino.
- Pixels e UTMs funcionam normalmente em ambos os domínios.

### Detalhes técnicos

- Os formulários são roteados pelo rewrite `/f/:path* → /index.html` que já existe no `vercel.json`.
- O SPA fallback novo (item 1) é defensivo — `/f/*` já funciona, mas garante que rotas fora de `/f/*` (ex: `/base-conhecimento/g/exocad/parametros-3d`) também não quebrem.
- Nenhuma mudança em Supabase, edge functions ou código frontend é necessária.
