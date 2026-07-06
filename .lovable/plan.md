## Diagnóstico

Quando o usuário seleciona **Danilo Henrique** em Campanhas e clica em "Sincronizar grupos", a lista de grupos não atualiza porque a edge function `wa-sync-groups` só sabe falar com **Evolution API (:8080)**.

- Danilo está com `messaging_provider = 'evolution_go'`, WhatsApp conectado apenas no **EvoGo (:8081)**.
- `wa-sync-groups` monta `${EVO_BASE}/group/fetchAllGroups/Danilo-Henrique` usando `EVO_BASE=http://82.25.75.61:8080` fixo. O servidor :8080 não conhece a instância → 404/erro silencioso → 0 grupos sincronizados → UI mostra os 298 grupos antigos (sync anterior de quando ele estava no Evolution).
- Toda a montagem em `_shared/evolution.ts` (`fetchInstances`, `fetchGroupsWithAdminFlag`) hardcoda `EVO_BASE` e ignora `evo_go_base_url` / `evo_go_instance_id` / `evo_go_instance_token`.

## Objetivo

`wa-sync-groups` deve rotear por membro conforme `messaging_provider`:
- `'evolution_go'` → EvoGo (base + instance_id + token do membro).
- caso contrário → Evolution API (comportamento atual).

## Mudanças

### 1. `supabase/functions/_shared/evolution.ts`
Adicionar tipo `EvoTarget` e sobrecargas que aceitem base URL customizada:

```ts
export type EvoTarget = {
  baseUrl: string;      // ex.: http://82.25.75.61:8081
  instance: string;     // path na URL: evo_go_instance_id OU evolution_instance_name
  apikey: string;       // evo_go_instance_token OU evolution_api_key
};

export async function fetchInstancesFor(t: EvoTarget): Promise<WaInstanceInfo[]> { ... }
export async function fetchGroupsWithAdminFlagFor(t: EvoTarget, hints: OwnerHints): Promise<...> { ... }
```

As funções atuais (`fetchInstances`, `fetchGroupsWithAdminFlag`) continuam existindo como wrappers que delegam para as novas passando `{ baseUrl: EVO_BASE, instance: ..., apikey: apikey ?? EVO_KEY }`. Zero regressão para Dra. Lia e demais instâncias Evolution.

Rotas EvoGo assumidas (mesmo formato Evolution/Baileys, já validado por `smart-ops-evogo-status`):
- `GET ${base}/instance/fetchInstances`
- `GET ${base}/group/fetchAllGroups/${instance}?getParticipants=true`

Header: `apikey: <token>`.

### 2. `supabase/functions/wa-sync-groups/index.ts`
- Ampliar o `SELECT` de `team_members` para incluir: `messaging_provider, evo_go_base_url, evo_go_instance_id, evo_go_instance_token`.
- Construir um `Map<instanceName, EvoTarget>` (`targetByInstance`):
  - Se `messaging_provider === 'evolution_go'` e houver `evo_go_instance_id` + `evo_go_instance_token` → target aponta pro EvoGo (base URL default `http://82.25.75.61:8081`). A **chave lógica** do map continua sendo `evolution_instance_name` (é isso que a UI seleciona e o que `wa_groups.instance_name` já usa — mantemos como identificador estável).
  - Senão → target Evolution :8080 com `evolution_api_key` / `evolution_instance_name`.
- Trocar `fetchInstances(apikey)` e `fetchGroupsWithAdminFlag(instanceName, hints, apikey)` por `fetchInstancesFor(target)` / `fetchGroupsWithAdminFlagFor(target, hints)`, sempre resolvendo `target` via `targetByInstance.get(inst.instanceName)`.
- Ao gravar em `wa_groups`, seguir usando `instance_name = <evolution_instance_name>` (o mesmo já cadastrado no membro) — a UI e `wa_campaign_groups` continuam funcionando sem mudança de schema.
- Log claro por instância: `provider=evolution_go|evolution base=... instance_path=...` para facilitar debug futuro.

### 3. Sem mudanças em
- Frontend (`SmartOpsWaGroupCampaigns.tsx`) — continua invocando `wa-sync-groups` com `{ instance_name }`.
- Banco / RLS / policies.
- `wa-dispatcher` e envio de mensagem (fora de escopo deste ticket).

## Verificação após deploy

1. Selecionar Danilo Henrique em Campanhas → clicar **Sincronizar grupos**.
2. Conferir logs de `wa-sync-groups`: linha `provider=evolution_go base=http://82.25.75.61:8081 instance_path=<uuid>`.
3. Consultar `SELECT COUNT(*), MAX(synced_at) FROM wa_groups WHERE instance_name='Danilo-Henrique'` — `synced_at` deve refletir o horário do teste.
4. Instâncias Evolution (Dra. Lia etc.) devem continuar sincronizando normalmente.

## Riscos / rollback

- Se o endpoint EvoGo divergir do padrão Evolution para `/group/fetchAllGroups`, o `processInstance` cai no `catch`, marca `error` no `per_instance` e não zera grupos existentes (o UPSERT só roda se `groupsToSync.length > 0`; o "marca órfãos" está dentro do mesmo if). Rollback = reverter as duas funções.
