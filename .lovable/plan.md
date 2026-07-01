## Diagnóstico

O sistema de tradução de `print_type` (Apresentações) já está funcionando nas rotas localizadas (`/es/base-conocimiento` e `/en/knowledge-base`). O problema real é que o **LanguageSelector perde a query string** ao trocar de idioma:

- Você está em `/base-conhecimento?tab=catalogo` (aba Catálogo).
- Ao trocar para 🇪🇸/🇺🇸, ele navega para `/es/base-conocimiento` **sem** `?tab=catalogo`.
- A página cai na aba default (`parametros`) — você não vê o Catálogo traduzido e tem a impressão de que continuou em PT / nada foi traduzido.

Confirmei em `src/components/LanguageSelector.tsx`: o `navigate(newPath)` usa apenas `pathname`, descartando `location.search` e `location.hash`.

## Correção (cirúrgica, 1 arquivo)

**`src/components/LanguageSelector.tsx`** — preservar query string e hash ao trocar idioma em rotas da Base de Conhecimento:

```ts
const newPath = knowledgeBasePaths[value] + suffix + location.search + location.hash;
navigate(newPath, { replace: true });
```

Com isso:

- `/base-conhecimento?tab=catalogo` + 🇪🇸 → `/es/base-conocimiento?tab=catalogo` (Catálogo já aberto, `Placas miorrelaxantes` → `Férulas miorrelajantes`, headers `Tipo de impresión` / `Imp/Frasco`, etc.).
- Mesmo comportamento para 🇺🇸 (`Occlusal splints`, `Prosthetic models (arch)`, etc.).
- Deep-link de artigo (`/base-conhecimento/g/slug`) continua funcionando — o `suffix` já cobre isso, agora preservando também query/hash.

## Validação

Após aplicar:

1. Abrir `/base-conhecimento?tab=catalogo`.
2. Trocar para Español no seletor → URL deve virar `/es/base-conocimiento?tab=catalogo` e aba Catálogo manter-se ativa.
3. Conferir card de qualquer resina: cabeçalhos da tabela em ES e linhas de `print_type` traduzidas.
4. Repetir para English.

Nenhuma mudança em `dentalTaxonomy.ts`, locales JSON, `KbTabCatalogo.tsx` ou `useCardTranslations.ts` — toda a infra de tradução já está correta; só precisamos chegar até a rota localizada com a aba certa.