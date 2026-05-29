## Objetivo
Garantir que o erro do `cs_principal` (instância sem `evolution_api_key`/`evolution_phone` próprios → `wa-sync-groups` caindo no `EVO_KEY` global e retornando 401/vazio) nunca mais aconteça.

## Mudanças de memória

### 1. Nova Core rule em `mem://index.md`
Adicionar à seção **Core** (sempre em contexto):

> **Evolution Per-Instance Credentials**: O Evolution self-hosted atribui `apikey` única por instância. TODA chamada Evolution para uma instância específica DEVE ler `evolution_api_key` (+ `evolution_phone`, `evolution_lid`) de `team_members` por `evolution_instance_name` e usar como override no header `apikey`. O `EVO_KEY` global é apenas último fallback. Sem isso: 401/lista vazia, instância nunca conecta e `recalculateAdminFlag` não marca admin. Toda nova instância DEVE ter `evolution_phone` + `evolution_api_key` preenchidos antes do primeiro sync.

### 2. Novo arquivo `mem://integration/evolution-per-instance-credentials`
Detalhamento técnico:
- Schema: `team_members.evolution_instance_name`, `evolution_api_key`, `evolution_phone`, `evolution_lid`
- Padrão correto já implementado em: `wa-sync-groups`, `smart-ops-lia-notify-seller` (`getBriefingConfig()`)
- Funções que precisam seguir o padrão: `wa-dispatcher`, `_shared/evolution.ts` (qualquer helper de envio)
- Checklist ao provisionar nova instância:
  1. Criar instância no painel Evolution
  2. Copiar Token/API Key
  3. `UPDATE team_members SET evolution_phone='55…', evolution_api_key='…' WHERE evolution_instance_name='…'`
  4. Disparar `wa-sync-groups` — `evolution_lid` é descoberto automaticamente
  5. Validar `SELECT count(*) FROM wa_groups WHERE instance_name='…' AND is_admin=true > 0`
- Sintoma de regressão: logs com `apikey=global` ou 401 em `wa-sync-groups`/`wa-dispatcher`

### 3. Atualizar referência em `## Memories` do índice
Adicionar:
`- [Evolution Per-Instance Creds](mem://integration/evolution-per-instance-credentials) — Cada instância tem apikey própria em team_members; EVO_KEY global é só fallback`

## Não-objetivos
- Nenhuma mudança de código nesta etapa (memória apenas).
- Auditoria de `_shared/evolution.ts`/`wa-dispatcher` para conformidade fica para próxima task se você quiser.
