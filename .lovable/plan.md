Importar a planilha direto nos produtos existentes do `system_a_catalog`, sem UI nova.

**Match**: `Grupo` da planilha → produtos cujo `name = Grupo` ou `name ILIKE 'Grupo%'` (cobre tanto produto único quanto família tipo "Atos Resina Composta Direta - DA1, - DA2…").

**O que adiciona** em `extra_data.system_a_live.technical_specs` (merge por label, não apaga linhas existentes):
- Grupo de variações, Tipo de variação, Variações disponíveis, SKUs, NCM, GTIN/EAN, Peso (kg), Dimensões (cm), Categoria, Fonte.

**Proteções**:
- Marca `manually_edited_at = now()` (cron não sobrescreve).
- Espelha o array final em `products_catalog.technical_specifications` para o card público refletir na hora.
- Idempotente — rodar de novo apenas atualiza os mesmos labels.

**Entrega**: um único `INSERT/UPDATE` SQL com os 36 grupos da planilha + relatório final (grupos casados, produtos enriquecidos, grupos sem match).
