
# Card não reflete o texto das instruções

## Diagnóstico

Dois problemas independentes convergem no sintoma:

1. **Sincronia texto → card frágil.** `ResinCardStudio` mantém um `hydratedResin` (snapshot do DB carregado 1x no mount) e um `plans[lang]` em estado. Se o cache `info_card_plan_pt` do DB estiver desatualizado ou se o `previewPlan` ficar preso ao estado antigo, o card não acompanha edições no textarea. O patch anterior priorizou o `resin.processing_instructions` do prop, mas ainda há caminhos onde o cache ganha (ex.: `plans.pt` inicializado uma vez pelo `useEffect`).

2. **Parser aceita seções duplicadas.** Se o texto contiver `## Pós-cura UV` mais de uma vez (por qualquer razão — IA de formatação, colagem, edição), `parseInstructionsMd` cria duas `Section` distintas. É por isso que aparecem "3 · Pós-cura UV" e "4 · Pós-cura UV" no card.

Escopo confirmado pelo usuário: (a) garantir sincronia texto→card e (b) deduplicar seções no parser. Sem mudar o prompt do "Formatar com IA".

## Mudanças

### 1. `src/components/resin-card/parseInstructionsMd.ts` — dedupe de seções

- Após montar `sections`, mesclar em pós-processo qualquer `Section` cujo `title` (normalizado: lowercase + sem acentos + trim) já exista antes na lista.
- Ao mesclar: concatenar `blocks` na primeira ocorrência e fundir `subsections` — subsections com `title` normalizado igual têm seus `blocks` concatenados; caso contrário, são adicionadas ao final.
- Preservar ordem original da primeira ocorrência.
- Idem para subsections dentro da mesma section (defesa extra caso `### Ciclo de cura` também apareça duplicado).

Resultado esperado no card do exemplo: 3 seções em vez de 4; "Pós-cura UV" contém "Ciclo de cura" com o bullet "Equipamentos e Tempos Recomendados" e seus sub-bullets no lugar certo.

### 2. `src/components/resin-card/ResinCardStudio.tsx` — sincronia texto→card

- Remover o `useEffect` que copia `planPt` para `plans.pt`. Trocar por um `plans` derivado por `useMemo` da tupla `(planPt, hydratedResin.info_card_plan_en, hydratedResin.info_card_plan_es)` mais um `overridePlans` (state) para as traduções obtidas em runtime via `ensurePlan`.
- `previewPlan` passa a ser: `overridePlans[previewLang] ?? (previewLang==='pt' ? planPt : hydratedResin?.[`info_card_plan_${previewLang}`]) ?? planPt`. Nunca mais serve `plans.pt` antigo — PT é sempre recomputado a partir do texto vivo.
- Manter `ensurePlan('pt')` retornando `planPt` diretamente (sem persistir no DB) para evitar gravar cache defasado enquanto o usuário edita.
- Continuar persistindo `info_card_plan_pt` apenas no momento do export (dentro de `handleExport` ou `ensurePlan('en'|'es')`), garantindo que o snapshot salvo corresponde ao texto que gerou aquela exportação.

### 3. Verificação

- Ler o `processing_instructions` atual da resina "Smart Print Bio Temp B1" no DB via `supabase--read_query` para confirmar se o texto salvo bate com o que o usuário colou. Se estiver diferente, informar o usuário — não vou reescrever conteúdo automaticamente.
- Testar mentalmente com o texto fornecido: parser deve produzir 3 seções (PRÉ, PÓS, Pós-cura UV), Pós-cura UV com 1 subsection "Ciclo de cura", contendo 1 bullet "Equipamentos e Tempos Recomendados" com 4 sub-bullets.

## Fora de escopo

- Não altero `format-processing-instructions/index.ts` nem o prompt do LLM.
- Não altero `resolveProductImage`, `ProductHero`, `exportInfographic` nem regravo caches existentes no DB.
- Não mexo em `translate-resin-card` — traduções EN/ES continuam usando cache do DB (o dedupe roda na conversão PT antes de traduzir).
