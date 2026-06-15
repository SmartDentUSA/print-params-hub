## Objetivo
Alterar o nome do filtro de categoria **Dentística e Estética** para **Dentística, Estética e Ortodontia** tanto no Catálogo quanto na tela de Revendas.

## Alterações
1. `src/locales/pt.json` — chave `kb.chips.dentistica`: `"Dentística e Estética"` → `"Dentística, Estética e Ortodontia"`
2. `src/locales/en.json` — chave `kb.chips.dentistica`: `"Dentistry and Aesthetics"` → `"Dentistry, Aesthetics and Orthodontics"`
3. `src/locales/es.json` — chave `kb.chips.dentistica`: `"Odontología y Estética"` → `"Odontología, Estética y Ortodoncia"`

## Impacto
- Apenas labels de tradução. Sem alterações em componentes, schema ou lógica de filtro.