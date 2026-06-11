# Fix: "Enviar publicação histórica" — link sem hero, thumb pixelada, link interno sem preview, rodapé errado

## Diagnóstico consolidado

Três pontos diferentes, uma raiz comum: hoje o blast cai em `type: 'image'` mandando a thumb pequena da CDN como anexo, e quando vira `type: 'link'` ele depende do `og:image` da página de destino — que **não existe** no template do artigo da Base de Conhecimento.

### 1. `HistoricalPostBroadcast.tsx → buildInitial()`
Escolhe `type: 'image' | 'link'` pela extensão da `thumbnail_url`. Em `image`:
- A thumb sai da CDN da Meta/YT em ~320px com query string expirável → chega **pixelada**.
- A Textarea de legenda some no modal → usuário não vê/edita link nem rodapé.
- O `picked.caption` original do post carrega **assinatura/rodapé antigo da empresa**, e sem campo visível o usuário não consegue limpar antes de enviar.

### 2. `supabase/functions/seo-proxy/index.ts` linha ~1790
Template do artigo da Base de Conhecimento emite:
```
<meta property="og:image" content="${content.og_image_url || content.content_image_url}" />
```
Sem fallback. Se nenhum dos dois campos está preenchido, sai `content=""` e o WhatsApp **não mostra hero** quando o usuário compartilha o link do artigo. Os outros templates da própria `seo-proxy` (resinas, produtos, suporte) já caem em `${baseUrl}/og-fluxo-digital.jpg` quando vazio — só o de artigo ficou fora desse padrão. Também não há normalização para URL absoluta caso o campo venha como path relativo.

## Solução

Duas frentes complementares.

### A. Forçar blast histórico para texto + URL

`src/components/social/broadcasts/HistoricalPostBroadcast.tsx`: substituir `buildInitial()` por versão única `type: 'msg'` com `caption + URL`, remover `detectMediaType()` e o import `Image as ImgIcon` se ficar órfão.

```ts
const buildInitial = () => {
  if (!picked) return undefined;
  const caption = (picked.caption ?? '').trim();
  const text = [caption, picked.url].filter(Boolean).join('\n\n');
  return { type: 'msg' as const, text };
};
```

Ganhos:
- Modal abre em "Texto" com Textarea visível → usuário **edita/remove o rodapé antigo** antes de enviar.
- Envio cai em `sendText` → WhatsApp gera **preview nativo HD** puxando o `og:image` em alta da página do post (Instagram 1080px, YouTube `maxresdefault`, TikTok HD), em vez da thumb pixelada da CDN.
- Link clicável aparece no card de preview.

### B. Garantir og:image em todos os artigos da Base de Conhecimento

`supabase/functions/seo-proxy/index.ts`, template do artigo (~linha 1790): aplicar fallback e normalização para URL absoluta — mesmo padrão dos demais templates.

```ts
const ogImageRaw = content.og_image_url || content.content_image_url || `${baseUrl}/og-fluxo-digital.jpg`;
const ogImage = ogImageRaw.startsWith('http') ? ogImageRaw : `${baseUrl}${ogImageRaw.startsWith('/') ? '' : '/'}${ogImageRaw}`;
// ...
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:secure_url" content="${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:image" content="${ogImage}" />
```

Também usar `ogImage` no `buildAIHeadTags({ image })` e no JSON-LD `Article.image` do mesmo template, para ficar consistente com o que os outros templates já fazem.

Resultado: ao compartilhar `/base-conhecimento/{letter}/{slug}` em qualquer grupo do WhatsApp, sempre aparece hero — o do próprio artigo quando existe, ou o banner padrão `og-fluxo-digital.jpg` como fallback.

## Fora do escopo

- Não mexer em `WaGroupBlastModal`, `wa-group-blast`, `wa-dispatcher` ou Evolution.
- Não tentar parsear/remover automaticamente rodapé antigo do caption (regex frágil) — edição manual na Textarea resolve com transparência.
- Não fazer upscaling/refetch da thumbnail original — preview nativo do WhatsApp já cobre via `og:image`.
- Não trocar templates de resinas/produtos/suporte na `seo-proxy` — eles já têm fallback correto.

## Validação

1. **Blast histórico:** selecionar post (foto IG / Reels / YouTube / TikTok) → "Configurar envio" → modal abre em "Texto" com `caption + URL` editáveis → limpar rodapé antigo → enviar para grupo de teste → chega texto editado + card de link nativo com thumbnail HD.
2. **Link da Base de Conhecimento:** compartilhar um artigo com `content_image_url` preenchido → preview com hero do artigo. Compartilhar um artigo SEM imagem → preview com `og-fluxo-digital.jpg` (não fica sem hero).
3. **Sanidade SEO:** `curl -A "WhatsApp/2.0" https://parametros.smartdent.com.br/base-conhecimento/a/<slug> | grep og:image` → sempre retorna URL absoluta válida.
