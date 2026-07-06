## Fix

### 1. Data update (via `insert` tool — UPDATE em tabela existente)
```sql
UPDATE public.team_members
SET messaging_provider = 'evolution_go'
WHERE nome_completo = 'Danilo Henrique'
  AND evolution_instance_name = 'Danilo-Henrique';
```
Danilo passa a rotear pelo EvoGo (:8081) usando `evo_go_instance_id` + `evo_go_instance_token` que já estão preenchidos.

### 2. Código: priorizar EvoGo quando duplicatas compartilham `evolution_instance_name`
Arquivo: `supabase/functions/wa-sync-groups/index.ts`

O loop atual usa **first-wins** (`if (!targetByInstance.has(name))` implícito). Vou trocar por regra explícita: **se qualquer linha ativa da instância tiver `messaging_provider='evolution_go'` com creds EvoGo completos, essa vence** — mesmo que outra linha `evolution` tenha sido lida primeiro.

Alterações no loop `for (const r of tmAll)`:
- Detectar `isEvoGo = provider === 'evolution_go' && evoGoInstance && evoGoToken`.
- Se `isEvoGo` → **sobrescrever** o target/provider/apikey já registrados para esse `name`.
- Se não é EvoGo → só grava se ainda não houver target (comportamento atual).
- Log final por instância: `winner_row=<nome_completo> provider=<...>`.

Assim, mesmo com "Suporte Tecnico" (provider=evolution) na frente, o Danilo (provider=evolution_go) sobrescreve e a sync roteia para :8081.

### 3. Validação após deploy
1. Selecionar Danilo em Campanhas → **Sincronizar grupos**.
2. Logs devem mostrar: `provider=evolution_go base=http://82.25.75.61:8081 instance_path=2b3058b8-…`.
3. `SELECT COUNT(*), MAX(synced_at) FROM wa_groups WHERE instance_name='Danilo-Henrique'` — `synced_at` recente.

## Fora de escopo
- Limpar as 9 duplicatas de `evolution_instance_name='Danilo-Henrique'` em outros membros (opção C rejeitada) — pode ser tratado depois se necessário.
- Frontend, RLS, schema — nenhuma mudança.

## Rollback
- `UPDATE ... SET messaging_provider='evolution'` para Danilo.
- Reverter o if/else de prioridade no `wa-sync-groups`.