# Performance por Vendedor — dados reais

## Diagnóstico

`src/components/SmartOpsSellerAutomations.tsx` tem 3 bugs que tornam os números irreais:

1. **Limite de 1000 linhas** em `lia_attendances` (tabela tem ~31k). Amostra enviesada.
2. **Falta `WHERE merged_into IS NULL`** — viola a regra Core do CDP (conta duplicatas merged).
3. **`status_atual_lead_crm === "Ganha"` nunca casa.** Os status reais são `cliente_ativo`, `Etapa 0X - Reativação`, `Fechamento`, etc. Resultado: **todos os vendedores aparecem com 0 ganhos e 0% de conversão** (confirmado via query).

Vendedor verdadeiro = quem fechou deals (tabela `deals`, `status_id = 2` = Ganha), não quem é proprietário do lead no CDP.

## Solução

Criar RPC `query_seller_performance()` em SQL que agrega tudo server-side a partir de fontes corretas, e refatorar o componente para consumi-la.

### 1. Migration: RPC `query_seller_performance`

Retorna uma linha por vendedor ativo (`team_members` onde `ativo=true AND role='vendedor'`), com:

- `name`, `whatsapp`
- `total_leads` — contagem em `lia_attendances` com `proprietario_lead_crm = nome_completo` **AND `merged_into IS NULL`**
- `won_deals` — `COUNT(*)` em `deals` com `owner_name = nome_completo AND status_id = 2`
- `revenue` — `SUM(value)` dos deals ganhos (últimos 12m)
- `open_deals` — deals com `status_id = 1`
- `last_lead_at` — `MAX(created_at)` de leads do CDP
- `conversion_rate` — `won_deals / NULLIF(total_leads,0) * 100`

`SECURITY DEFINER`, search_path travado, grant para `authenticated`.

### 2. Refatorar `SmartOpsSellerAutomations.tsx`

- Substituir as 2 queries client-side por `supabase.rpc('query_seller_performance')`.
- Remover o cálculo client-side em memória.
- Manter UI (ranking por conversão, badges, ícone Trophy no topo).
- Trocar o badge "by status" (que dependia da varredura client) por **ticket médio** (`revenue / won_deals`) — informação mais útil e já vem do RPC.

## Detalhes técnicos

- Patrícia Gastaldi continua excluída via memória existente (`patricia-gastaldi-blocked-seller`) — o filtro `ativo=true` em `team_members` já cuida disso se ela estiver inativa; caso contrário, adicionar `AND nome_completo <> 'Patricia Gastaldi'` no RPC.
- Janela de receita: últimos 365 dias (`closed_at >= now() - interval '365 days'`).
- Performance: agregação 100% no Postgres, sem 1000-row cap, sem write amplification.

## Arquivos afetados

- `supabase/migrations/<timestamp>_seller_performance_rpc.sql` (novo)
- `src/components/SmartOpsSellerAutomations.tsx` (refator)

## O que NÃO muda

- Layout/UI, tokens de design, posicionamento na aba Equipe.
- Demais componentes Smart Ops.
