## Objetivo

1. Ao trocar a **moeda** na Tabela de Preço, recalcular automaticamente `price_base` e `price_dealer` usando os valores da moeda correspondente do **Catálogo de Produtos** (`price`, `price_usd`, `price_eur`) — sem precisar clicar em "Recalcular".
2. Mostrar a **cotação atual USD/BRL e EUR/BRL** no cabeçalho do Hub de Distribuição, ao lado do título "Distribuição — Tabelas de Preço & Propostas".

## Escopo

### 1. Auto-recalc ao trocar moeda (`DealerPriceTable.tsx`)

- No `onValueChange` do `Select` de moeda:
  - Persistir a nova moeda em `dealer_price_lists` (já feito).
  - Em seguida, chamar automaticamente a lógica atual de `recalcFromCatalog` para atualizar `price_base` (e `price_dealer` respeitando o `discount_pct` de cada item) com o preço da moeda escolhida (USD → `price_usd`, EUR → `price_eur`, demais → `price`).
  - Persistir a recalculagem no banco (hoje `recalcFromCatalog` só atualiza estado local + marca dirty). Vou trocar por uma versão que faz `UPDATE` em lote nos itens afetados e depois recarrega, para não deixar linhas "dirty" pendurando após uma troca de moeda.
  - Disparar auto-snapshot com rótulo `Moeda alterada para USD (recalc do catálogo)` para manter o histórico coerente com a política já existente.
- Manter o botão manual "Recalcular preços do catálogo" (útil se o catálogo mudar de preço sem trocar de moeda).
- Fallback continua igual: se o produto não tiver preço na moeda alvo, usa `price` (BRL) e mostra `toast.warning` com contagem.

### 2. Cotação USD/EUR no cabeçalho (`DistributorsHub.tsx`)

- Componente novo, pequeno e isolado: `FxRateBadge` (em `src/components/smartops/distributors/FxRateBadge.tsx`).
  - `useEffect` faz `fetch` para `https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL` (API pública, sem chave, muito usada em projetos BR — retorna JSON com `USDBRL.bid` e `EURBRL.bid`).
  - Cache em `sessionStorage` por 10 minutos para evitar rate limit e evitar refetch a cada navegação de aba.
  - Render minimalista à direita do título:
    ```text
    USD 5,4321 · EUR 5,8912   (atualizado 14/07 10:22)
    ```
  - Se o fetch falhar, o badge não é exibido (fail-silent — não atrapalha o hub).
- No `DistributorsHub.tsx`, colocar o badge no mesmo bloco do título usando `flex justify-between items-start` para ficar alinhado à direita, sem quebrar o layout mobile (empilha em telas pequenas).

## Detalhes técnicos

- API: `https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL` (grátis, CORS liberado, sem chave). Alternativa se falhar: manter só o USD via `USDBRL`.
- Formatação: `Intl.NumberFormat("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })` para 4 casas (padrão de câmbio).
- Auto-recalc: reaproveito a função existente `recalcFromCatalog`, extraindo o núcleo para uma versão parametrizada `recalcAndPersist(currency)` que:
  1. Busca `price`, `price_usd`, `price_eur` do `system_a_catalog` para os `catalog_product_id` da tabela.
  2. Monta lista de `UPDATE` por item (novo `price_base` + `price_dealer` recalculado com o desconto salvo).
  3. Executa em paralelo (`Promise.all` de `.update()...eq(id)` — mesmo padrão do `saveAll` atual).
  4. Recarrega os itens do banco.
  5. Dispara `autoSnapshot`.

## Fora do escopo

- Não vou converter preços entre moedas por câmbio (ex.: USD → BRL via cotação). A regra continua sendo: cada moeda usa o campo próprio do catálogo (`price`, `price_usd`, `price_eur`).
- Não vou alterar o Catálogo de Produtos nem o Wizard de Propostas.
- Nenhuma migração de banco.

## Arquivos afetados

- `src/components/smartops/distributors/DealerPriceTable.tsx` — auto-recalc + persistência no `onValueChange` da moeda.
- `src/components/smartops/distributors/DistributorsHub.tsx` — inserir `FxRateBadge` no cabeçalho.
- `src/components/smartops/distributors/FxRateBadge.tsx` — novo (fetch + cache + render).
