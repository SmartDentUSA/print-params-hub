# WA Groups v2 — Multi-instância + Grupos Compartilhados + Central de Campanhas

Backend e frontend serão entregues juntos em uma sequência única.

## 1. Backend — migration

Nova migration:

- `wa_groups`: adicionar `enabled boolean default true`. Backfill `enabled = is_admin` (não-admin já entram desabilitados por padrão).
- `wa_groups`: índice `(instance_name, enabled, is_admin)` para o filtro do frontend.
- `wa_campaign_groups` (nova tabela junction, 1 campanha → N grupos):
  - `campaign_id uuid` FK → `wa_campaigns(id) on delete cascade`
  - `group_id uuid` FK → `wa_groups(id) on delete cascade`
  - `created_at timestamptz default now()`
  - PK composta `(campaign_id, group_id)`
  - GRANTs (`authenticated` full, `service_role` all) + RLS.
- View `v_wa_group_summary`: recriar para incluir `enabled`, `instance_name` (já tem), e marcar `in_shared_campaign` quando o grupo pertence a uma campanha sem `group_id`. Continua exibindo a "campanha do card" via `active_campaign_id`.
- View `v_wa_combined_campaigns`: nova. Lista campanhas com `group_id IS NULL` e agrega via `wa_campaign_groups` os arrays de grupos + totais (`group_count`, `total_members`, contadores de fila).
- RPC `fn_detach_group_from_campaign(p_campaign_id, p_group_id)`: remove o registro de `wa_campaign_groups`, limpa `wa_groups.active_campaign_id` se apontava para esta campanha e cancela mensagens `pending` da fila daquele grupo nesta campanha. `security definer`.

## 2. Backend — Evolution multi-instância

Em `supabase/functions/_shared/evolution.ts`:

- Manter `EVO_INST` legado, mas tornar `fetchAdminGroups`, `sendText`, `sendMedia` parametrizáveis por `instanceName` (default = `EVO_INST`).
- Nova função `fetchInstances()` que chama `GET /instance/fetchInstances` e retorna `WaInstanceInfo[]` (filtrando `connectionStatus === 'open'`).

## 3. Backend — edge functions

- `wa-sync-groups` refator:
  - Sem body → chama `fetchInstances()`, sincroniza todas as instâncias conectadas, retorna `{ instances: WaInstanceInfo[], synced: number, per_instance: {…} }`.
  - Com `{ instance_name }` → sincroniza só aquela.
  - Em cada upsert, gravar `instance_name` correto (não mais EVO_INST hardcoded).
- `wa-campaign-builder` refator multi-group:
  - Aceitar `campaign_id` (mesma assinatura) ou criar fila a partir de `wa_campaign_groups` quando `wa_campaigns.group_id IS NULL`.
  - Para cada grupo da junction: gera filas independentes (mesmo cronograma base, anti-duplicata por grupo).
  - Continuar setando `wa_groups.active_campaign_id` em cada grupo participante.
  - Single-group antigo segue funcionando (path `group_id` direto).
- `wa-group-blast` (nova):
  - Body: `{ group_jids: string[], message_type: 'msg'|'image'|'video'|'audio'|'document'|'link', content: {...}, scheduled_at?: string, campaign_name?: string, instance_name?: string }`.
  - Cria 1 `wa_campaigns` com `status='active'`, `flow_json` de 1 nó (tipo `blast`).
  - Insere N linhas em `wa_campaign_groups` + N linhas em `wa_message_queue` com `scheduled_at` (default = now + 30s).
  - Marca `wa_groups.active_campaign_id` em cada grupo (somente se o grupo está livre).
  - Retorna `{ ok, campaign_id, groups, queued, first_send }`.
- `wa-dispatcher`: nenhuma mudança estrutural — já lê fila por linha; só precisa usar a `instance_name` correta do registro (parametrizar `sendText/sendMedia`).

## 4. Frontend — `src/components/smartops/wa-groups/`

> Observação importante: o prompt enviado cita o path `src/components/smart-ops/...`. O caminho real é `src/components/smartops/...`. Vou seguir o caminho real.

### Refator `SmartOpsWaGroupCampaigns.tsx`

- Estado novo: `instances`, `selectedInstance`, `selectionMode`, `selectedGroupIds`, `combinedCampaigns`.
- Header:
  - `Select` de instância (carrega via `wa-sync-groups` sem body); se 1 só, fica desabilitado.
  - Botão `Sincronizar`, `Selecionar grupos`, `+ Nova campanha`.
- Query: `v_wa_group_summary` filtrada por `instance_name`. Em paralelo, query `v_wa_combined_campaigns`.
- Render:
  - Para campanhas multi-group: 1 `WaCombinedCampaignCard` `col-span-full` no topo.
  - Para grupos sem campanha combinada: cards individuais com badge admin/não-admin, toggle `enabled` (`Switch`), opacidade reduzida quando `!enabled`, e botão "Criar régua" desabilitado com tooltip quando `!is_admin`.
- Modo seleção: checkbox em grupos `is_admin && enabled`; footer fixo com contagem + `Criar fluxo compartilhado` + `Blast pontual` + `Cancelar`.
- Realtime: adicionar `wa_groups` e `wa_campaign_groups` ao canal existente.

### `WaCombinedCampaignCard.tsx` (novo)

- Lista os grupos da campanha com toggle de desanexar (chama `fn_detach_group_from_campaign` via RPC).
- Mostra status, próximo envio, totais e ações (`Ver fluxo`, `Pausar/Retomar`, `Editar`).

### `WaGroupMultiSelect.tsx` (novo)

- Listagem de `wa_groups` `is_admin=true AND enabled=true` com checkboxes, agrupada por instância, com contagem de membros e footer de seleção. Usado pelo Builder e pela Central de Campanhas.

### `WaGroupBlastModal.tsx` (novo)

- Dialog max-w-xl, com `DialogTitle/Description` (corrige warning a11y atual).
- Tipo de mensagem (radio): texto/imagem/vídeo/áudio/documento/link — reusa `WaMediaUploader` já existente.
- Agendamento: "Agora (em 30s)" ou data/hora específica.
- Confirma → `supabase.functions.invoke('wa-group-blast', { body })`.

### Refator `WaGroupFlowBuilder.tsx`

- Substituir `groupId` único por suporte a `groupIds: string[]`.
- Painel esquerdo: trocar resumo do grupo por `WaGroupMultiSelect` (pré-marcado quando vier de seleção múltipla ou de edição multi-group).
- Salvar:
  - Se 1 grupo → mantém path atual (`wa_campaigns.group_id`).
  - Se 2+ → `wa_campaigns.group_id = null` + linhas em `wa_campaign_groups`.
  - Ao ativar: chama `wa-campaign-builder` (já adaptado).
- Carregar campanha: se `group_id IS NULL`, popular seleção a partir de `wa_campaign_groups`.

### `types.ts`

Atualizar `WaGroupSummary` com `enabled`, `in_shared_campaign`; adicionar `WaInstanceInfo`, `WaCombinedCampaign`.

## 5. Integração na Central de Campanhas

`SmartOpsCampaigns.tsx`, Step 1 (Segmentação):

- Novo segmento `'wa-groups'` (card com ícone `MessageSquare`).
- Quando selecionado, renderiza `WaGroupMultiSelect` no lugar dos filtros de leads e preenche `selectedGroups/Names/totalReach`.
- Step 3 (Execução): se `segmentType === 'wa-groups'`, dispara `wa-group-blast` em vez de `bulk_campaign`.

## 6. QA

- Migration roda + linter limpo nas nossas alterações.
- `wa-sync-groups` (sem body) retorna instâncias e sincroniza todas.
- `wa-group-blast` cria fila correta para 2+ grupos.
- `wa-campaign-builder` continua funcionando single-group e funciona multi-group.
- Frontend: filtro por instância, toggle enabled persiste, modo seleção funcional, card combinado abre detalhes, desanexar grupo via RPC reverte para card individual, blast modal envia.
- Corrigir warning a11y dos Dialogs (incluir `DialogTitle` + `DialogDescription`/visually-hidden).

## Detalhes técnicos

- TypeScript strict, zero cor hardcoded, tokens semânticos.
- RLS: `wa_campaign_groups` segue mesma política de `wa_campaigns` (somente authenticated).
- `wa-group-blast` valida body via Zod; CORS via `_shared/evolution.ts`.
- Realtime mantém um único canal com 4 tabelas (`wa_campaigns`, `wa_message_queue`, `wa_groups`, `wa_campaign_groups`).
- `WaMediaUploader` (já criado anteriormente) é reusado no Blast e no flow.

## Arquivos

```
Migration nova:
  supabase/migrations/<timestamp>_wa_groups_v2.sql

Edge functions:
  supabase/functions/_shared/evolution.ts            (parametrizar instância + fetchInstances)
  supabase/functions/wa-sync-groups/index.ts         (multi-instância)
  supabase/functions/wa-campaign-builder/index.ts    (multi-group)
  supabase/functions/wa-dispatcher/index.ts          (usar instance_name da fila)
  supabase/functions/wa-group-blast/index.ts         (NOVA)

Frontend:
  src/components/smartops/wa-groups/types.ts         (modificar)
  src/components/smartops/wa-groups/SmartOpsWaGroupCampaigns.tsx (refator)
  src/components/smartops/wa-groups/WaGroupFlowBuilder.tsx       (multi-group)
  src/components/smartops/wa-groups/WaCombinedCampaignCard.tsx   (NOVO)
  src/components/smartops/wa-groups/WaGroupMultiSelect.tsx       (NOVO)
  src/components/smartops/wa-groups/WaGroupBlastModal.tsx        (NOVO)
  src/components/SmartOpsCampaigns.tsx                           (Step 1 + Step 3)
```

Não tocar: `WaContentNodeSelector.tsx`, `WaGroupFlowVisualizer.tsx`, `WaFlowVisualizerPage.tsx`, `App.tsx`, `WaMediaUploader.tsx`.
