## Objetivo
1. Permitir seleção de mês/ano no Relatório Comercial (hoje fixo no mês atual).
2. Mostrar status atual de leads (etapas abertas) por vendedor.
3. "Deals Enviados para Estagnados por Vendedor" considerar somente vendedores ativos no mês selecionado.

## Backend (migration)
Substituir as 4 views fixas por funções SQL parametrizadas `(p_ano int, p_mes int)`:

- `fn_relatorio_mes_kpis(p_ano, p_mes)` → mesmos campos da view atual, com `mes_ref = to_char(make_date(p_ano,p_mes,1),'YYYY-MM')`.
- `fn_relatorio_mes_vendedor(p_ano, p_mes)` → mesmas colunas.
- `fn_relatorio_mes_origem(p_ano, p_mes)` → mesmas colunas.
- `fn_relatorio_mes_funil_estagnados(p_ano, p_mes)` → retorna `(vendedor, qtd, total_deals_mes, pct)` já filtrado para vendedores ativos no mês (vendedores com ≥1 deal ganho/perdido/criado no mês).
- `fn_relatorio_mes_funil_atual(p_ano, p_mes)` → snapshot atual de deals abertos por vendedor/funil/etapa, restrito aos vendedores ativos no mês (status atual dos leads em cada etapa de cada vendedor).

GRANT EXECUTE para `authenticated` e `service_role`. Views antigas podem ser mantidas (compat) ou dropadas — vou manter por segurança.

## Frontend (`RelatorioMensalComercial.tsx`)
- Estado `ano`/`mes` (default = mês corrente em America/Sao_Paulo).
- Header: dois `Select` (mês + ano, últimos 24 meses) + botão refresh.
- `fetchAll` passa a usar `supabase.rpc('fn_relatorio_mes_*', { p_ano, p_mes })`.
- Refazer fetch quando `ano/mes` mudam.
- Nova seção "Status atual dos leads por vendedor" agrupando `fn_relatorio_mes_funil_atual` por vendedor → tabela colapsável por funil/etapa com qtd.
- Card de Estagnados usa direto `fn_relatorio_mes_funil_estagnados` (já filtrado a vendedores ativos), removendo o cálculo client-side atual.

## Detalhes técnicos
- "Vendedor ativo no mês" = aparece em `fn_relatorio_mes_vendedor` (tem deals ganhos, perdidos ou leads atribuídos no mês).
- Estagnados: deals com status `aberta` cujo `pipeline_name ILIKE '%Estagnados%'`, agrupado por owner_name, mas só linhas onde owner_name ∈ ativos do mês.
- Snapshot atual ignora o mês na contagem (são deals abertos hoje), mas usa o mês apenas para filtrar quais vendedores aparecer.
- Mês default e label continuam usando timezone `America/Sao_Paulo`.

## Arquivos tocados
- Nova migration `supabase/migrations/<ts>_relatorio_mensal_param.sql`
- `src/components/admin/RelatorioMensalComercial.tsx`
