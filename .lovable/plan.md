## Objetivo
No card do catálogo (`/es/base-conocimiento?tab=catalogo` e EN), os valores PT que vazam para o usuário ES/EN devem aparecer no idioma da UI:

1. **Tabela Apresentações** → coluna `Tipo de impresión` mostra valores PT (`Placas miorrelaxantes`, `Modelos Mockup`, `Base prótese total`, …) mesmo em ES/EN. Cabeçalhos já estão traduzidos; só os dados.
2. **Ficha técnica (📊 Tabela técnica)** → reforçar para que rows com edição manual recente e rows vindas de `resins.technical_specs` sempre tenham fallback traduzido (label + value) em EN/ES.

## Mudanças

### 1. Dicionário canônico para `print_type` (resin_presentations)
Hoje há ~20 valores distintos em `resin_presentations.print_type` (Placas miorrelaxantes, Coroas sobre dente, Facetas, Protocolo, Modelos Alinhadores, Modelos Clareamento, Modelos Mockup, Modelos Protéticos (Arco), Par Zocalados, Base dentadura, Base prótese total, Biomodelos- Tc (Quadrante), Elemento unitário, Guia parcial, Simulação gengiva, …). Conjunto fechado e estável.

- Adicionar em `src/lib/dentalTaxonomy.ts` um mapa `PRINT_TYPE_I18N` (chave = label PT normalizado em lowercase/trim, valor = chave i18n) com helper `translatePrintType(value, t)` que:
  - normaliza (`trim`, colapsa espaços duplos, lowercase),
  - retorna `t(key)` se houver entrada,
  - faz fallback para o PT original (não quebra valores novos).
- Adicionar a árvore `kb.catalogo.print_types.*` em `src/locales/pt.json`, `en.json`, `es.json` com cada termo traduzido (PT mantém o original; EN/ES usam termo odontológico correto, ex.: `placas_miorrelaxantes` → `Occlusal splints` / `Férulas miorrelajantes`).

### 2. Aplicar no card
Em `src/components/knowledge/KbTabCatalogo.tsx`:
- Substituir `pr.print_type || '—'` (linha ~864) e a versão de `formatPresChip` (linha ~702-708) por `translatePrintType(pr.print_type, t) || '—'`.
- Manter `pr.label` como está (numérico + `g`).

### 3. Reforço da ficha técnica EN/ES
A `useCardTranslations`/`translate-card-row` já cobre `system_a_catalog.technical_specs`, `products_catalog.technical_specifications` e `resins.technical_specs`. Hoje, quando o card cai no fallback "resin exato" (linhas 752-758), a leitura usa `(resinExact as any).technical_specs_en/_es`, mas o hook não dispara tradução para `resins` se o card não estiver na lista do hook.

- Garantir que o hook `useCardTranslations` chamado em `KbTabCatalogo` também enfileire IDs de `resins` (tabela `resins`) cuja `technical_specs` é usada como fallback do card e cujo `technical_specs_<lang>` esteja vazio, para que a próxima renderização já traga traduzido (idempotente, sem custo se já traduzido). Sem mudar a UI; apenas adiciona uma segunda invocação do hook com `table: 'resins'` para os ids relevantes.

### 4. Sem migração / sem mudanças de schema
Tudo via i18n e hook existente. Nenhuma alteração em `resin_presentations` (o conjunto é pequeno e o dicionário é mais barato e determinístico que um campo `_en/_es` por linha).

## Arquivos tocados
- `src/lib/dentalTaxonomy.ts` (adiciona mapa + helper)
- `src/locales/pt.json`, `src/locales/en.json`, `src/locales/es.json` (chaves `kb.catalogo.print_types.*`)
- `src/components/knowledge/KbTabCatalogo.tsx` (usa helper; segunda chamada de `useCardTranslations` para `resins` fallback)

## Fora de escopo
- `resin_presentations.label` (valores numéricos como "250g"/"500g") — não precisa traduzir.
- Edição em massa de specs no banco — só translate-on-read via edge function já existente.
