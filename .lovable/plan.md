Diagnóstico encontrado

- As páginas carregam lento porque `src/App.tsx` importa tudo estaticamente: admin, social, Dra. LIA, editores, analytics, calendário, broadcasts etc. No preview medi FCP perto de 9,5–10s e 128–150 recursos carregados mesmo em páginas simples.
- O `/admin` piora isso porque `AdminViewSecure.tsx` importa dezenas de componentes pesados antes de saber qual aba será exibida.
- `DataProvider` abre listeners realtime globais para `brands`, `models`, `resins` e `parameter_sets` em qualquer página, inclusive visitantes públicos.
- `DraLIA` é carregada globalmente em páginas públicas e já faz consulta em `lia_attendances` no mount, competindo com o carregamento inicial.
- Formulários públicos `/f/:slug` não estão passando pelo SSR SEO para bots: o `vercel.json` manda `/f/*` direto para `index.html` antes da regra de bot, e o `seo-proxy` retorna 404 para `/f/terceirizacao-projetos-cad`.
- O `seo-proxy` cobre bem artigos da base de conhecimento, mas não formulários. Também transforma erro interno em 404, o que pode aparecer para Google/IA como “página inexistente” em vez de erro transitório.
- O banco tem consultas lentas relevantes em `lia_attendances`, especialmente busca por `platform_lead_id OR raw_payload`, rotinas de health logs e backfills. Isso pode degradar edge functions e painéis, mas não é a principal causa do FCP alto no frontend.

Plano de correção

1. Reduzir o bundle inicial
   - Converter rotas pesadas de `src/App.tsx` para `React.lazy` + `Suspense`.
   - Lazy-load especialmente `/admin`, `/social`, páginas de conhecimento mais pesadas, `DraLIA`, formulários e visualizadores.
   - Manter a primeira tela funcional com fallback leve, sem mudar UI ou regras de negócio.

2. Otimizar o `/admin`
   - Dividir `AdminViewSecure.tsx` para carregar cada seção/aba sob demanda.
   - Manter somente autenticação, sidebar e shell inicial no bundle do admin.
   - Carregar componentes como SmartOps, relatórios, cursos, analytics, campanhas e social somente quando a aba for aberta.

3. Remover trabalho global desnecessário
   - Desativar `useRealtimeUpdates()` para visitantes públicos; manter realtime somente em contexto administrativo ou onde for realmente necessário.
   - Remover logs verbosos do `DataProvider` que estão poluindo console e serializando funções/objetos grandes.
   - Carregar `DraLIA` com lazy/defer nas páginas públicas, preservando a exclusão de admin/embed/social/agenda.

4. Corrigir SEO/GEO/IA Ready dos formulários públicos
   - Adicionar suporte a `/f/:slug` no `seo-proxy` para gerar HTML semântico dos formulários com título, descrição, imagem, canonical, OG/Twitter e JSON-LD.
   - Ajustar `vercel.json` para bots de `/f/*` irem ao `seo-proxy`, enquanto humanos continuam recebendo o SPA.
   - Testar com User-Agent de Googlebot em pelo menos um formulário real.

5. Endurecer o `seo-proxy` contra quebras
   - Diferenciar “conteúdo não encontrado” de falha interna temporária.
   - Logar erros com contexto de rota/slug.
   - Evitar que falhas transitórias sejam mascaradas como 404 quando a página existe.
   - Manter cache adequado para HTML gerado e reduzir consultas redundantes quando possível.

6. Corrigir gargalos de dados de alto impacto
   - Trocar o N+1 de `getResinsByModel` por uma única consulta em lote.
   - Analisar com `EXPLAIN` as queries lentas principais antes de criar índices.
   - Se confirmado pelo plano de execução, criar índices direcionados para buscas canônicas em `lia_attendances` e logs de saúde, sem alterar regras de negócio.

Validação

- Medir novamente abertura de `/f/terceirizacao-projetos-cad`, uma página de artigo e `/admin`.
- Confirmar queda de recursos carregados inicialmente e FCP menor.
- Confirmar que Googlebot recebe HTML 200 para artigo e formulário público.
- Confirmar que humanos continuam recebendo o SPA e que formulários ainda submetem normalmente.