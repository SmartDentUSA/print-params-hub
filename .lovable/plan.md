
Situação atual

- Não parece que vocês “perderam tudo”.
- O banco está íntegro: há 780 artigos ativos e 780 com `content_html` preenchido.
- O artigo atual (`a-ciencia-por-tras-da-resina-3d-smart-print-bio-vitality`) ainda tem `content_html` com ~26,9k caracteres.
- O fluxo de renderização continua existindo no código:
  `KnowledgeBase` → `KnowledgeContentViewer` → `PDFContentRenderer` → `DirectHTMLRenderer` → `dangerouslySetInnerHTML`.
- No que consegui verificar agora, o corpo do artigo aparece tanto no preview quanto em `https://parametros.smartdent.com.br/...`.
- Não encontrei erro JS relevante nessa rota.
- Também não encontrei artigos ativos usando `pdf-viewer-container`, então o parser de PDF não parece ser a causa principal de um sumiço em massa.

Do I know what the issue is?

Sim: pelo que foi possível validar, isso não é perda de dados no Supabase. O cenário está muito mais compatível com deploy/cache/build inconsistente entre ambientes do que com conteúdo apagado.

Plano

1. Confirmar exatamente qual ambiente ainda está “vazio”
- Comparar a mesma URL em:
  - preview Lovable
  - domínio publicado `.lovable.app`
  - domínio customizado/Vercel
- Se só um deles estiver quebrado, tratar como problema de deployment/cache e não de frontend nem banco.

2. Validar o deployment ativo no Vercel
- Conferir se o custom domain está servindo o deployment mais recente.
- Se houver divergência, fazer redeploy do último deployment saudável ou do commit mais recente correto.
- Testar também a URL direta do deployment do Vercel para separar “build atual” de “cache do domínio”.

3. Blindar o render do artigo
- Em `src/components/KnowledgeContentViewer.tsx`, adicionar fallback explícito:
  - se `processedHTML` vier vazio mas `displayContent.content_html` existir, renderizar o HTML bruto.
- Em `src/components/DirectHTMLRenderer.tsx`, adicionar guardas simples para evitar transformação silenciosa que zere o conteúdo.
- Manter `dangerouslySetInnerHTML` como caminho principal.

4. Simplificar a camada intermediária
- Em `src/components/PDFContentRenderer.tsx`, deixar o comportamento mais conservador:
  - qualquer dúvida no parse → renderizar tudo com `DirectHTMLRenderer`.
- Objetivo: impedir que exista “card vazio” quando `content_html` estiver preenchido.

5. Verificação final
- Testar a rota atual e mais alguns artigos PT/EN/ES.
- Confirmar texto visível no preview e no domínio final.
- Confirmar que o SEO para bots continua funcionando sem afetar usuários reais.

Arquivos que devem ser revisados/ajustados
- `src/components/KnowledgeContentViewer.tsx`
- `src/components/DirectHTMLRenderer.tsx`
- `src/components/PDFContentRenderer.tsx`
- `vercel.json` apenas se a divergência aparecer no deployment do Vercel

Resultado esperado
- Confirmar formalmente que os artigos não foram perdidos.
- Corrigir qualquer ambiente preso em bundle/deploy antigo.
- Garantir fallback de render para que `content_html` nunca desapareça visualmente mesmo se alguma etapa intermediária falhar.
