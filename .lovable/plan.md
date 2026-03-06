

## Problema

A Lista de Leads mostra sempre "1000" porque a query em `SmartOpsLeadsList.tsx` (linha 741) tem `.limit(1000)` hardcoded. A tabela `lia_attendances` tem **24.815 leads**.

Carregar todos os 24.8k leads de uma vez seria lento e consumiria muita memoria no browser. A solucao correta e implementar **paginacao server-side**.

## Solucao: Paginacao Server-Side

**Arquivo:** `src/components/SmartOpsLeadsList.tsx`

### Mudancas

1. **Contador real**: Usar `supabase.from("lia_attendances").select("*", { count: "exact", head: true })` para obter o total real (24.815) e exibir no header.

2. **Paginacao com `.range()`**: Substituir `.limit(1000)` por `.range(from, to)` usando o estado `page` que ja existe (linha 732). Cada pagina carrega 200 leads.

3. **Filtros server-side**: Mover os filtros principais (status, source, temperatura) para a query do Supabase em vez de filtrar client-side, permitindo paginar corretamente sobre o dataset filtrado.

4. **UI de paginacao**: Adicionar botoes "Anterior / Proxima" e indicador "Pagina X de Y" no rodape da lista.

### Resumo tecnico

| Item | Atual | Proposto |
|------|-------|----------|
| Total exibido | Sempre 1000 | Total real (24.815+) |
| Carregamento | 1000 de uma vez | 200 por pagina |
| Filtros | Client-side | Server-side (query) |
| Paginacao | Estado existe mas nao usado | `.range()` com botoes |

### Impacto
- Header mostrara "Lista de Leads (24.815)" em vez de "(1000)"
- Navegacao entre paginas sem recarregar tudo
- Filtros funcionarao sobre todo o dataset, nao apenas os 1000 primeiros

