## Objetivo

Substituir os cards atuais de `KbTabDistribuidores.tsx` por um layout compacto, igual à referência: logo grande à esquerda, nome em destaque, bandeira do país e ícones de redes sociais (apenas as habilitadas).

## Arquivo único

`src/components/knowledge/KbTabDistribuidores.tsx`

## Mudanças no card

Remover do card:
- Bloco de razão social secundária
- Linha de cidade/estado (`local`)
- Chips de `authorized_scope`
- Blocos de contato (`ContactBlock` para "Responsável" e "Compras")

Manter no card:
- Logo (esquerda, ~80–96px, quadrado arredondado, fundo branco/cinza claro, borda sutil)
- Nome (`nome_fantasia || razao_social`) em destaque, peso 700
- Bandeira do país (`CountryFlag`) ao lado do nome ou abaixo
- Ícones de redes sociais coloridos em círculos brancos com borda, mostrando apenas as redes que têm URL preenchida (lógica `visible` já existe em `SocialIcons` — manter inalterada)

Layout do card:
- Flex horizontal: `[logo] [nome + bandeira + redes sociais empilhados verticalmente]`
- Padding interno generoso, borda `#e2e8f0`, raio 12px, sombra sutil
- Em telas estreitas, manter a mesma estrutura (o logo encolhe levemente)

## O que NÃO muda

- Filtros, busca, chips de categorias, contagem de resultados, skeleton, empty state
- Lógica de fetch do Supabase (mesmo `select`)
- Componentes auxiliares `CountryFlag`, `SocialIcons`, mapa `COUNTRY_TO_ISO`
- Função `waLink` e `ContactBlock` ficam no arquivo mas deixam de ser usadas (podem ser removidas para limpar o arquivo)

## Validação

Recarregar a aba Distribuidores e conferir visualmente que cada card mostra apenas logo + nome + bandeira + ícones das redes habilitadas, idêntico à referência.
