## Substituir "Detalhamento por Cliente (Deals Recentes)" por Relatório Mensal Comercial

### Escopo
Em `src/components/SmartOpsReports.tsx` (Painel Admin → Smart Ops → Reports), o card "Detalhamento por Cliente (Deals Recentes)" (linhas 215–282) é substituído por `<RelatorioMensalComercial />`. O card "Detalhamento por Cliente (Ativos)" (linha 287+) permanece intacto; o botão "Exportar CSV Completo" é movido para o header desse card "Ativos" para preservar a funcionalidade.

### Views Supabase (confirmadas no banco)
`v_relatorio_mes_kpis`, `v_relatorio_mes_vendedor`, `v_relatorio_mes_funil`, `v_relatorio_mes_origem`.

### Migration (pré-requisito de permissão)
Rodar antes do código:
```sql
GRANT SELECT ON
  public.v_relatorio_mes_kpis,
  public.v_relatorio_mes_vendedor,
  public.v_relatorio_mes_funil,
  public.v_relatorio_mes_origem
TO anon, authenticated;
```

### Novo componente: `src/components/admin/RelatorioMensalComercial.tsx`

**Imports**: `supabase` de `@/integrations/supabase/client`; shadcn `Card`, `Badge`, `Button`, `Skeleton`, `Table*`, `Separator`; ícones `RefreshCw`, `AlertTriangle` (lucide).

**Estado/efeitos**
- Estados: `kpis`, `vendedores`, `funil`, `origens`, `loading`, `error`, `lastUpdated`
- `fetchAll()` faz `Promise.all` das 4 queries (`v_relatorio_mes_kpis` com `.single()`; demais com `.select('*')`)
- `useEffect` chama no mount + `setInterval(fetchAll, 15*60*1000)` com cleanup
- Botão refresh chama `fetchAll()` imediato

**Layout (dark theme, tokens semânticos)**
1. **Header** — Título `Relatório Comercial · {fmtMes(kpis.mes_ref)}` + Badge "Atualizado às HH:MM" + botão `RefreshCw` (anima durante loading)
2. **KPIs** — grid 4 colunas (`Card` cada): Receita CRM, Deals ganhos, Ticket médio, Leads criados (valores em `font-mono`)
3. **Vendas por Vendedor** — `Table` ordenada por `receita DESC`; coluna Conversão `(deals_ganhos/leads_mes)*100` com `Badge` colorido (verde ≥30, azul 15–29, âmbar 5–14, vermelho <5); linha "Total" no rodapé
4. **Estagnados por Vendedor** — derivado de `funil.filter(f => /Estagnados/i.test(f.funil))` agrupado por vendedor; para cada um: nome, qtd, % sobre total de deals do vendedor no mês (cruza com `vendedores`), barra de progresso via `div` com `style={{width: pct+'%'}}` colorida (vermelho >70, âmbar 50–70, verde <50) — conforme nota do usuário, evita limitações do `<Progress>` shadcn
5. **Conversão por Origem** — `Table` filtrada `total_leads >= 3`, ordenada por `receita DESC`; dividida em "Alta conversão (≥50%)" e "Baixa conversão (<50%)" com `<Separator />` entre os blocos

**Helpers**
- `fmtBRL(v)` via `Intl.NumberFormat('pt-BR', { style:'currency', currency:'BRL' })`
- `fmtMes('2026-05' → 'Mai/2026')`
- Loading: `<Skeleton />` nas 4 seções
- Erro: card com mensagem + botão "Tentar novamente"

**Estilo** — apenas tokens (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`); cores semânticas `text-green-500/amber-500/red-500/blue-500` (padrão atual do SmartOpsReports).

### Alterações em `src/components/SmartOpsReports.tsx`
- `import RelatorioMensalComercial from '@/components/admin/RelatorioMensalComercial'`
- Remover bloco linhas 215–282 (`<Card>` "Deals Recentes")
- Inserir `<RelatorioMensalComercial />` no lugar
- Mover botão "Exportar CSV Completo" para o `CardHeader` do card "Ativos"

### Fora do escopo
- Não mexer no card "Ativos" (conteúdo) nem nas correções 1–4 anteriores
- Não criar tab nova (`so-reports` já existe em `AdminViewSecure`)
- Sem cache local, sem CSV PipeRun, sem outras mudanças de schema