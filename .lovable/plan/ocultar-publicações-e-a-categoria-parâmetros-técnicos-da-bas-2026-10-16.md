# Ocultar publicações e a categoria "Parâmetros técnicos" da Base de Conhecimento (mantendo SEO)

## Objetivo
Tirar da navegação para visitantes as 8 publicações listadas e a categoria "Parâmetros técnicos", sem apagar nada e mantendo as URLs públicas acessíveis e indexáveis pelo Google (como já acontece com a Categoria F).

## O que muda para o usuário
- As publicações abaixo deixam de aparecer em listas, cards, busca e "relacionados" da Base de Conhecimento:
  - Resina Cristalizou ou Engrossou? Veja o Que Fazer
  - Peça Soltou da Plataforma Durante a Impressão — Solução
  - Peça com Camadas Deslocadas, Zebras ou Linhas na Impressão
  - Peça não curou ou ficou mole após impressão 3D — como resolver
  - Software CAD/CAM Não Abre STL ou Erro ao Exportar
  - Scanner Intraoral Não Reconhece o Computador — Solução
  - Peça com Manchas ou Superfície Irregular: Causas
  - FDA 510(k) Clearance K260152 — Smart Print Bio Vitality
- A aba/categoria "Parâmetros técnicos" some do menu da Base de Conhecimento.
- Quem tiver o link direto continua abrindo a página; o Google continua indexando (sitemap e canonical mantidos).
- No admin, tudo continua visível e editável, com um selo "Oculto da navegação".

## Etapas
1. Localizar as 8 publicações pelo título e confirmar a categoria/aba "Parâmetros técnicos" (qual tabela/flag a controla hoje).
2. Adicionar um marcador "oculto da navegação" (sem desativar a página) e aplicá-lo às 8 publicações.
3. Filtrar esse marcador em todas as listagens públicas: lista por categoria, busca, destaques, relacionados e respostas da Dra. LIA que sugerem links (avaliar: LIA pode continuar citando, pois são úteis para suporte).
4. Ocultar a aba "Parâmetros técnicos" na navegação pública, mantendo as rotas.
5. Garantir que sitemap, canonical e o renderizador para robôs continuam servindo essas páginas (sem `noindex`).
6. Verificar no navegador: páginas fora da lista, link direto abrindo, sitemap contendo as URLs.

## Próxima fase (separada, após aprovação)
Reformular estruturalmente as páginas de parâmetros para SEO/GEO: corrigir valores vazios/zerados, remover schema exposto como texto, resumo técnico no topo, troubleshooting e FAQs reais por combinação, depois ativar as 207 inativas e traduzir.

## Detalhes técnicos
- Preferir coluna booleana `hidden_from_listing` em `knowledge_contents` (default false) em vez de desativar `active`, porque `active=false` tiraria do sitemap/SSR.
- Filtros aplicados nas queries públicas do front e nas Edge Functions de listagem; `seo-proxy` e sitemaps não filtram pela flag.
- Nada é apagado; reversível desmarcando a flag.
