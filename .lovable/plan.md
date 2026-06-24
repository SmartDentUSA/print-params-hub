## Objetivo
Exibir um resumo global no topo da página **Post Grupos** indicando a quantidade total de grupos selecionados e a soma de participantes impactados, independentemente de cada instância estar ATIVA ou INATIVA.

## Alterações

### 1. `src/components/social/PostGrupos.tsx`
- Adicionar fetch de `v_post_group_targets_detail` no carregamento inicial, junto com `post_group_instance_config`.
- Calcular agregados:
  - `totalSelectedGroups`: número total de targets.
  - `totalImpactedMembers`: soma de `member_count` de todos os grupos selecionados.
- Renderizar um **summary card** no topo da aba "Instâncias" (abaixo do título da página), com destaque visual, mostrando:
  - Total de grupos selecionados.
  - Total de membros impactados.
- Garantir que o summary seja recalculado quando `onChanged` for disparado pelos cards.

### 2. `src/components/social/PostGruposInstanceCard.tsx`
- No callback `load()` após adicionar um grupo e no `removeTarget()`, garantir que `onChanged()` seja chamado para que o summary global seja atualizado.
- O total por instância no header e no footer continua funcionando como hoje.

## Regras
- Soma de **todos os grupos salvos** (`post_group_targets`), independente do switch ATIVA/INATIVA da instância.
- Formato numérico: `pt-BR` (ex: `1.025`).
- Reutilizar a view existente `v_post_group_targets_detail` para evitar duplicar joins.

## Fora do escopo
- Sem alterações no banco de dados (tabelas, views, migrations).
- Sem criação de edge functions.
- Sem alterações no histórico de disparos.