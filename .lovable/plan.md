## Remover pill de preço do hero

O bloco `ATIVAÇÃO + 1º MÊS · R$ 2.390 · depois R$ 1.199/mês` voltou a aparecer no hero.

### Correção

Em `src/components/lp/PremiumLandingTemplate.tsx`:

1. Remover o bloco `{c.hero.pricePill && (…)}` do hero (~linha 464-475) — a seção de Condições abaixo já cumpre esse papel.
2. Remover `pricePill` de `DEFAULT_LP_CONTENT.hero` para não reaparecer em LPs novas.
3. Manter o campo `pricePill` no tipo `LPContent.hero` como opcional para não quebrar dados existentes; ele só deixa de ser renderizado.

Em `src/components/smartops/LandingPageBuilderModal.tsx`: se houver campos do editor para `pricePill`, removê-los para não gerar dado inútil (verificar durante a implementação).

### Fora do escopo

- Não altero a seção de Condições nem outras partes da LP.
- Não altero a lógica de publicação nem a geração via IA (o campo permanece no tipo, então prompts antigos não quebram).
