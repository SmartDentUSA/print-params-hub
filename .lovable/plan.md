## Diagnóstico

Verifiquei contra o banco real:

- `deals.status` possui apenas três valores: `aberta` (28.471), `ganha` (3.816), `perdida` (118).
- A RPC `fn_relatorio_mes_kpis` filtra por `status='won'`/`'lost'`/`NOT IN ('won','lost')`. Nenhum deal casa, então:
  - `deals_ganhos`, `receita_won`, `ticket_medio`, `perdidas_mes`, `clientes_unicos` → sempre 0.
  - `funil_ativo` conta **todos** os deals criados até o fim do mês (28k), porque `'aberta' NOT IN ('won','lost')` é sempre verdadeiro.
- A RPC `fn_relatorio_mes_vendedor_detalhe`:
  - Filtra por `status='won'`/`'lost'`/`NOT IN ('won','lost')` → ganhas e perdidas sempre 0; "abertos" inclui ganhas+perdidas+aberta.
  - Retorna colunas `(vendedor, abertos, estagnados, perdidas, ganhas)` enquanto o frontend lê `total_criados`, `abertas`, `estagnados_pct` → tudo `undefined` → 0.
- A RPC `fn_relatorio_mes_vendedor` já usa os valores corretos (`'ganha'`/`'perdida'`) — por isso só essa coluna ("Vendas por Vendedor") aparenta funcionar.

Resultado visível no painel: card "Funil ativo" com número absurdo, "Perdidas no mês" e "Estagnados" em 0 para todo mundo, cards "Funil por Vendedor" mostrando `0 abertas / 0 perdidas`, "De 0 deals criados no mês".

## Mudanças (somente banco — duas RPCs)

Migration única ajustando duas funções, sem mexer em frontend, edge functions, RLS, grants ou outras telas. As funções continuam `SECURITY DEFINER` com `search_path=public`.

### 1) `fn_relatorio_mes_kpis(p_ano, p_mes)`
- Trocar `status='won'` → `status='ganha'`, `status='lost'` → `status='perdida'`, `NOT IN ('won','lost')` → `= 'aberta'` (ou `NOT IN ('ganha','perdida')`, mantendo a mesma semântica).
- Aplicar timezone `America/Sao_Paulo` no recorte de `closed_at` e `piperun_created_at` (igual ao que a RPC de vendedor já faz), para o coorte do mês bater com a UI.
- Excluir pipelines não comerciais (`Funil Atos`, `Funil E-book`, `Tulip-Teste-*`, `Exportação`, `Ganhos Aleatórios*`) — mesma lista usada em `fn_relatorio_mes_vendedor` — para os KPIs serem consistentes com a tabela "Vendas por Vendedor".
- Preservar a assinatura/colunas existentes (`receita_won, receita_meta, deals_ganhos, deals_criados, taxa_conversao, ticket_medio, funil_ativo, perdidas_mes, enviados_estagnados, clientes_unicos`).

### 2) `fn_relatorio_mes_vendedor_detalhe(p_ano, p_mes)`
- Trocar a assinatura para devolver exatamente as colunas que o frontend consome:
  - `vendedor text, total_criados int, abertas int, ganhas int, perdidas int, estagnados int, estagnados_pct numeric`.
- Calcular cada coluna usando os status reais (`ganha`/`perdida`/`aberta`), no timezone São Paulo, mesma lista de pipelines comerciais do item 1, e mesma definição de coorte do mês (`piperun_created_at` dentro do mês selecionado):
  - `total_criados` = todos os deals da coorte do vendedor.
  - `abertas` = snapshot atual dos deals do vendedor com `status='aberta'` (sem filtrar coorte, igual ao que `fn_relatorio_mes_funil_atual` já faz, para casar com o "Funil ativo").
  - `ganhas` / `perdidas` = deals fechados no mês com status correspondente.
  - `estagnados` = deals da coorte cujo `stage_name ILIKE '%estagnad%'` (mantém regra atual, agora com status correto e respeitando filtros).
  - `estagnados_pct` = `estagnados / NULLIF(total_criados,0) * 100`.
- Manter a normalização de `owner_name` (`NULLIF`, ignorar IDs numéricos) já presente.

### 3) Sem alterações em `fn_relatorio_mes_funil_atual`
Já usa `status='aberta'` corretamente. Só será revalidado depois que `fn_relatorio_mes_vendedores_ativos` (chamada por ela) continuar listando vendedores certos — vamos conferir essa função na migration; se estiver com o mesmo bug de `'won'/'lost'`, corrigir junto, com a mesma regra.

## Validação após aplicar

Para o mês corrente:
- `funil_ativo` deve ficar coerente com a contagem real de `deals` `status='aberta'` (não mais 28k cumulativos).
- `perdidas_mes` ≠ 0 quando houver `status='perdida'` no mês.
- "Funil por Vendedor": cada card mostra `abertas` igual ao snapshot do vendedor; `ganhas` e `perdidas` batem com a tabela "Vendas por Vendedor"; "De N deals criados no mês" deixa de ser 0 quando o vendedor teve criação.
- Tabela "Vendas por Vendedor" continua idêntica (não mexemos nessa RPC).
