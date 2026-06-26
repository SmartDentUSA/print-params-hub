## Objetivo
Remover do frontend todos os filtros e bloqueios que escondem/desabilitam grupos WhatsApp por `is_admin = false`. Manter o campo apenas como informação visual (badge), nunca como condição de exibição ou seleção.

## Escopo confirmado (somente frontend + view)

**Arquivos a alterar:**

1. `src/components/smartops/wa-groups/WaGroupMultiSelect.tsx` (Blast Pontual + outros usos)
   - Remover o filtro `if (!includeNonAdmin) q = q.eq("is_admin", true);` — passa a listar TODOS os grupos ativados, sempre.
   - Remover a prop `includeNonAdmin` (e o default `false`) — não há mais dois modos.
   - Manter o badge "não admin" (informativo, não bloqueante) exibido sempre que `g.is_admin === false`.
   - Ajustar a mensagem de lista vazia para "Nenhum grupo encontrado." (sem texto "elegível admin").

2. `src/components/smartops/wa-groups/SmartOpsWaGroupCampaigns.tsx` (Campanhas de grupos)
   - `filtered`, `enabledCount`, `disabledCount`: remover a condição `r.is_admin` — contagens e lista passam a refletir todos os grupos da instância.
   - `canSelect`: passa a `row.enabled` (sem `row.is_admin`). Checkbox deixa de ser desabilitado por não-admin.
   - Remover a variável `disabled = !row.is_admin` (não usada após o ajuste) e qualquer leitura derivada.
   - Manter os badges "Admin" / "Não admin" como rótulos informativos.
   - `adminCount` pode permanecer apenas como métrica de telemetria do header (não bloqueia nada).
   - `.order("is_admin", ...)` pode ser mantido (ordenação ≠ filtro).

3. View `v_post_group_targets_detail` (migration nova)
   - A view atual **não** filtra por `is_admin` — confirmação feita via `pg_get_viewdef`. Nenhuma alteração necessária.
   - Caso o usuário queira garantir explicitamente, podemos publicar um `CREATE OR REPLACE VIEW` idêntico ao atual como no-op documentado. Default: **não criar migration**, já que não há filtro a remover.

## Fora de escopo (não alterar — conforme pedido)
- Edge functions: `wa-dispatcher`, `wa-broadcast-dispatch`, `wa-group-blast`, `wa-campaign-builder`, `wa-sync-groups`.
  - ⚠️ Observação importante: `wa-group-blast/index.ts:61` ainda contém `groups.filter(g => g.is_admin && g.enabled)`. Sem alterar o backend, mesmo que o frontend permita selecionar grupos não-admin para um blast, eles serão descartados no envio. Posso apenas sinalizar isso na UI (toast informativo) ou aguardar instrução futura para destravar no backend.
- Tabelas `wa_groups`, `post_group_targets`.

## Validação
- Abrir Blast Pontual e confirmar lista mostra grupos não-admin com badge âmbar e checkbox habilitado.
- Abrir Campanhas de grupos: contadores ativados/desativados aumentam para incluir não-admin; checkbox de seleção habilitado também para não-admin.
- Sem regressão em PostGrupos (já não filtra por is_admin).
