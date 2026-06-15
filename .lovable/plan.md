## Objetivo
Alterar o nome do filtro de categoria **Dentística e Estética** para **Dentística, Estética e Ortodontia** tanto no Catálogo quanto na tela de Revendas. Reordenar o botão **Caracterização** para vir após **Pós-impressão**.

## Alterações
1. `src/locales/pt.json` — chave `kb.chips.dentistica`: `"Dentística e Estética"` → `"Dentística, Estética e Ortodontia"`
2. `src/locales/en.json` — chave `kb.chips.dentistica`: `"Dentistry and Aesthetics"` → `"Dentistry, Aesthetics and Orthodontics"`
3. `src/locales/es.json` — chave `kb.chips.dentistica`: `"Odontología y Estética"` → `"Odontología, Estética y Ortodoncia"`
4. `src/components/knowledge/kbCategoryTaxonomy.ts` — reordenar `CHIP_KEYS`: mover `CARACTERIZAÇÃO` para após `PÓS-IMPRESSÃO` (antes de `DENTÍSTICA, ESTÉTICA E ORTODONTIA`)

## Impacto
- Apenas labels de tradução e ordem de exibição dos chips. Sem alterações em schema ou lógica de filtro.