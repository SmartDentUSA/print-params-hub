## Objetivo
Padronizar todos os labels dos botões de filtro (chips) em todas as abas para "Sentence case": primeira letra maiúscula, restante minúsculo.

## Implementação

1. **Adicionar utilitário `toSentenceCase`** em `src/components/knowledge/kbCategoryTaxonomy.ts`:
   - Converte string inteira para minúsculas e capitaliza apenas o primeiro caractere alfabético.
   - Preserva acentos (ex: "Pós-impressão", "Dentística e estética", "Caracterização").

2. **Aplicar no componente `KbChips`** (`src/components/knowledge/KbChips.tsx`):
   - Renderizar `{toSentenceCase(o.label)}` no botão.
   - Centralizar aqui garante cobertura de TODAS as abas (Catálogo, Revendas, subcategorias dinâmicas, e qualquer outro consumidor do `KbChips`) sem precisar tocar em cada i18n/categoria.

3. **Resultado esperado**:
   - "Todos" → "Todos"
   - "Scanners 3D" → "Scanners 3d"  ⚠️ ver pergunta abaixo
   - "RESINAS 3D" → "Resinas 3d"
   - "PÓS-IMPRESSÃO" → "Pós-impressão"
   - "MODELO DE TRABALHO" → "Modelo de trabalho"

## Pergunta de decisão
O termo "3D" virará "3d" com a regra estrita. Confirma que pode ficar assim, ou prefere manter "3D" maiúsculo como exceção (única exceção)?

## Fora do escopo
- Não altera dados no banco.
- Não altera badges dos cards de Revendas (são texto informativo, não botões). Posso incluir se desejar.