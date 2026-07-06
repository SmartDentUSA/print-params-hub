## Objetivo
Mostrar no modal do Team Member a **URL do webhook** que cada instância tem configurada — buscada ao vivo da Evolution API (:8080) e do Evolution GO (:8081) — em ambas as seções (Evolution e Evolution GO). Somente leitura. Também atualizar o token EvoGo do Danilo Henrique.

## Alterações

### 1. Edge function `smart-ops-evogo-status` — estender para retornar webhook
- Além de `state`, incluir `webhook_url` e `webhook_events` no JSON de retorno.
- Faz `GET ${base}/webhook/find/${instance}` com header `apikey: evo_go_instance_token` (padrão que Evolution API e EvoGo compartilham).
- Se 404/erro → `webhook_url: null`.
- Não altera contrato existente; frontend só passa a ler os campos novos.

### 2. Nova edge function `smart-ops-evolution-webhook-info`
- Para o **Evolution API clássico** (:8080). Recebe `{ member_id }`.
- Lê `evolution_base_url` + `evolution_api_key` + `evolution_instance_name` de `team_members`.
- Faz `GET ${base}/webhook/find/${instance_name}` com header `apikey`.
- Retorna `{ webhook_url, webhook_events, enabled }` ou `null` se não configurado.
- Motivo de ser função separada: usa credenciais diferentes das do EvoGo; mantém single-responsibility.

### 3. Frontend `src/components/SmartOpsTeam.tsx`
- Novos estados: `evolutionWebhook` e `evoGoWebhook` (`{ url: string|null, events?: string[] }`).
- Ao abrir o modal em `openEdit`:
  - Se tem credencial Evolution → chama `smart-ops-evolution-webhook-info` e popula `evolutionWebhook`.
  - Se tem credencial EvoGo → o próprio `smart-ops-evogo-status` já traz o webhook; popular `evoGoWebhook`.
- Renderizar em cada seção, logo abaixo do último campo (Base URL), um bloco read-only:
  ```
  Webhook configurado
  https://... (copiar ao clicar)  [🟢 ativo | 🔴 desativado]
  Eventos: MESSAGES_UPSERT, CONNECTION_UPDATE, ...
  ```
  Quando não houver webhook: `— Nenhum webhook configurado —` em texto muted.
- Botão "Copiar" ao lado da URL (usa `navigator.clipboard`).

### 4. UPDATE do token do Danilo (via insert tool, é operação de dados)
```sql
UPDATE public.team_members
SET evo_go_instance_token = '31a54fac-92f6-4c36-a4c4-3dcd8b5f9293'
WHERE id = '39657ed1-3151-4f45-b8a2-ca4b9eb6e932';
```

## O que NÃO muda
- Nenhum campo novo em `team_members` (webhooks são só leitura, não persistem).
- Nada em `wa-dispatcher`, envio de mensagens ou lógica de negócio.
- Nenhuma outra seção do modal.
