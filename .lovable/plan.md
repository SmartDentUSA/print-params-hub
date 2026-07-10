## Problema

Ao gerar o e-mail espelhando a Landing Page, a seção **Posicionamento / Oferta** aparece com o placeholder literal `{strike}` no corpo do texto e sem o preço-âncora riscado. Exemplo entregue pelo usuário:

> "DentalCAD Ultimate Lab Bundle de **{strike}** por R$ 2.390,00…"

## Causa

Em `supabase/functions/smart-ops-generate-email-ai/index.ts`:

1. `loadLpDossier` (linhas 365–369) copia apenas `eyebrow`, `headline` e `body` do `content.positioning`, **descartando** `strikePrice` e `highlightPrice` que existem na LP (`PremiumLandingTemplate`/`LandingPageBuilderModal`).
2. `buildLpEmailHtml` (bloco `positioningHtml`, ~linhas 496–506) faz `esc(positioning.headline)` sem trocar o token `{strike}`, então o texto sai literal.

Na LP real (`PremiumLandingTemplate.tsx` linhas 869–876) o token é substituído por um `<span>` com `text-decoration:line-through` contendo `strikePrice`. O e-mail precisa fazer o mesmo, em HTML inline-safe para Gmail.

## Correção (arquivo único: `smart-ops-generate-email-ai/index.ts`)

1. **Tipo `LPDossier.positioning`** (linha 123) e o parâmetro `positioning` de `buildLpEmailHtml` (linha 406): acrescentar `strikePrice?: string; highlightPrice?: string`.
2. **`loadLpDossier`** (linha 365): também copiar `strikePrice` e `highlightPrice` (com `cleanLpText`).
3. **Chamada de `buildLpEmailHtml`** (linha 885): repassar `strikePrice` e `highlightPrice`.
4. **`buildLpEmailHtml` → `positioningHtml`**: renderizar `positioning.headline` fazendo `split("{strike}")`, escapando cada pedaço e intercalando com um `<span style="text-decoration:line-through;color:${t.textSoft};font-weight:800;">${esc(strikePrice)}</span>` (fiel ao visual da LP). Se `strikePrice` estiver vazio, remover o token para não deixar `{strike}` sobrando.
5. Mesmo tratamento defensivo em `hero.headline`/`sub` **não** é necessário — o token só existe em `positioning.headline` por design.

Nenhuma outra função, tabela ou fluxo é alterado. Deploy: `smart-ops-generate-email-ai`.

## Validação

1. Regenerar o e-mail da mesma LP em Central de Campanhas.
2. Conferir que a seção Posicionamento mostra `de R$ 3.700 por R$ 2.390,00` (preço riscado renderizado) e o texto restante idêntico à LP.
3. Testar LP sem `strikePrice` para garantir que o token some sem deixar `{strike}` visível.
