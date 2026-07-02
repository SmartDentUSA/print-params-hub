## Adicionar exclusão de membros na Equipe Smart Ops

Em `src/components/SmartOpsTeam.tsx`, adicionar botão "Excluir" na coluna Ações de cada linha da tabela de membros, com confirmação via `AlertDialog` para evitar remoção acidental.

### Comportamento
- Botão ícone lixeira (variant destructive, size sm) ao lado do botão de editar.
- Ao clicar, abrir `AlertDialog` com o nome do membro: "Tem certeza que deseja excluir {nome}? Esta ação não pode ser desfeita."
- Ao confirmar: `supabase.from('team_members').delete().eq('id', member.id)`, toast de sucesso/erro e recarregar a lista.
- Se o delete falhar por FK constraint (membro referenciado por deals/leads), capturar o erro e mostrar toast sugerindo desativar o membro (toggle `ativo`) em vez de excluir.

### Escopo
- Apenas alteração de UI + chamada de delete no componente `SmartOpsTeam.tsx`.
- Sem migrações no banco — a tabela `team_members` já suporta delete e o admin já opera nela (RLS existente).