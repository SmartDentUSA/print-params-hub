## Aba "Post Grupos" no Social Publisher

Painéis por instância (Danilo, Ana Paula CS, Dra. Lia) com lista salva de grupos para disparo. Toggle ATIVA/INATIVA por instância. Modal de adição + histórico de disparos. Sem edge function (separada).

### Arquivos novos
- `src/components/social/PostGrupos.tsx` — container; lê `post_group_instance_config`, agrega contadores via `post_group_targets` + `wa_groups`. Renderiza um `PostGruposInstanceCard` por instância. Aba inferior com `PostGruposHistory`.
- `src/components/social/PostGruposInstanceCard.tsx` — header (nome, total membros, total grupos disponíveis, switch ATIVA/INATIVA → atualiza `post_group_instance_config.enabled`). Tabela dos grupos selecionados (`post_group_targets` + join `wa_groups` para nome/membros). Botão lixeira → `DELETE` da row em `post_group_targets`. Footer com totais. Botão "+ Adicionar" abre modal.
- `src/components/social/PostGruposAddModal.tsx` — busca `wa_groups` da instância (`ativo=true`) excluindo `group_id` já presentes em `post_group_targets` daquela instância. Input de busca client-side, checkboxes múltiplos, botão "Adicionar (N)" faz `INSERT` em batch em `post_group_targets` (`instance_name`, `group_id`, `enabled=true`).
- `src/components/social/PostGruposHistory.tsx` — últimos disparos de `wa_group_dispatch_log` filtrados por `dispatch_source='post_grupos'` (ou sem filtro inicial), com nome do grupo, instância, status, preview, `sent_at`.

### Arquivos editados
- `src/App.tsx` — adicionar `const PostGrupos = lazy(...)` e `<Route path="post-grupos" element={<PostGrupos />} />` dentro do `<Route path="/social" element={<SocialLayout />}>`.
- `src/components/social/SocialSidebar.tsx` — adicionar item `{ title: 'Post Grupos', url: '/social/post-grupos', icon: Send }` logo após "Avaliações".

### Dados
- Já existem: `post_group_instance_config` (id, instance_name, enabled, is_primary, evolution_phone), `post_group_targets` (id, instance_name, group_id, enabled), `wa_groups` (id, name, member_count, instance_name, ativo), `wa_group_dispatch_log`.
- View `v_post_group_targets_detail` disponível — usar para listar selecionados com nome/membros já agregados.
- Sem migrations novas. Sem edge function.

### Comportamento
- Realtime opcional (subscribe em `post_group_targets`) para atualizar contadores; se complicar, refetch após mutação basta.
- Toggle ATIVA/INATIVA não apaga seleção — apenas alterna `enabled` na config (cards inativos colapsam mostrando só header e aviso "disparo suspenso").
- Toasts via `sonner` em adicionar/remover/toggle.
