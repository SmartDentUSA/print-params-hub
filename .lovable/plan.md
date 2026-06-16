## Adicionar filtro "Filtrar por país" em Revendas

**Onde**: `src/components/knowledge/KbTabDistribuidores.tsx`

**O que fazer**:
1. Calcular `availableCountries` a partir de `rows` (apenas países com ISO conhecido em `COUNTRY_TO_ISO`), ordenados alfabeticamente, deduplicados.
2. Adicionar estado `country: string` (default `'all'`).
3. Renderizar um `<Select>` (shadcn) ao lado/abaixo do `KbSearchBar` com placeholder "Filtrar por país", opção "Todos" + uma opção por país disponível, cada uma com `<CountryFlag>` + nome.
4. Estender o `useMemo` de `filtered` para incluir `country !== 'all' && normalize(r.pais) !== normalize(country)`.
5. Não exibir o select se `availableCountries.length <= 1`.

**Fora de escopo**: nenhum outro componente, schema ou lógica de negócio.