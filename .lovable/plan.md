# Copilot: autonomia total sobre fluxos sociais

## Situação atual

O Copilot já tem 6 tools para `social_flows`: `list`, `get`, `create`, `update`, `toggle`, `delete`. A tool `create_social_flow` **já** chama a API do Zernio automaticamente ao criar (linhas 2829-2860 de `smart-ops-copilot/index.ts`).

**Gap real:** fluxos que já existem sem `zernio_automation_id` (caso exocad RMS) não podem ser provisionados pelo Copilot — nem `toggle` nem `update` disparam o registro no Zernio. Foi por isso que precisei rodar `zernio-provision-flow` manualmente.

## O que fazer

### 1. Nova tool `provision_social_flow` no Copilot
Arquivo: `supabase/functions/smart-ops-copilot/index.ts`

- Definição da tool (após `delete_social_flow`, ~linha 1088):
  - `name: "provision_social_flow"`
  - `description`: "Registra/re-registra a automação de um flow comment_to_dm existente no Zernio, populando `zernio_automation_id`. Use quando: (a) flow foi criado sem provisionar, (b) `zernio_automation_id` está null, (c) usuário pede para 'ativar/testar de verdade' um flow comment-to-DM, (d) `toggle_social_flow` reclamar de id ausente."
  - `parameters`: `{ id: string (uuid do flow) }`

- Executor `executeProvisionSocialFlow(args)`:
  - Lê o flow em `social_flows`
  - Se já tem `zernio_automation_id` → retorna `{ ok: true, already_provisioned: true }`
  - Extrai keywords/dm_message/comment_reply do node `comment_trigger` + `send_dm`
  - Chama `POST https://zernio.com/api/v1/comment-automations` com header `Authorization: Bearer ZERNIO_API_KEY` (mesmo padrão de `create_social_flow`, linhas 2834-2860) — reaproveitar a lógica em helper `provisionZernioComment(flow)` compartilhado entre `create` e `provision`
  - Atualiza `social_flows.zernio_automation_id`
  - Retorna `{ ok, zernio_automation_id, zernio_status }`

- Registrar no dispatch `TOOL_HANDLERS` (~linha 2969): `provision_social_flow: executeProvisionSocialFlow`.

### 2. Auto-provisionar ao ativar
No `executeToggleSocialFlow` (~linha 2895), antes de setar `is_active:true`:
- Se flow é `comment_to_dm` e `zernio_automation_id` é null → chamar `provisionZernioComment(flow)` inline.
- Retornar `zernio_status` no result para o Copilot reportar ao usuário.

### 3. Atualizar system prompt do Copilot
Seção "Comment-to-DM" (~linha 3079):
- Adicionar: "Se `toggle_social_flow` retornar `zernio_status` ⚠️ ou o usuário pedir para testar um flow existente sem `zernio_automation_id`, chame `provision_social_flow({id})` antes de ativar."
- Adicionar ao Passo 0: quando listar, sinalizar flows sem `zernio_automation_id` como "não provisionado".

### 4. Ajuste em `list_social_flows`
Incluir `zernio_automation_id` no select (~linha 2751) para o Copilot enxergar quais estão provisionados.

## Como o usuário vai usar

Comandos naturais que passarão a funcionar de ponta a ponta:
- *"Cria um flow comment-to-DM para a palavra 'RESINA' respondendo com link X"* → `create_social_flow` (já funcionava)
- *"Ativa o fluxo exocad RMS e deixa funcional"* → `toggle_social_flow` auto-provisiona
- *"Aquele flow que criei ontem não está respondendo no Instagram"* → Copilot chama `list` → identifica `zernio_automation_id` null → chama `provision_social_flow`
- *"Registra a automação do fluxo Copa no Zernio"* → `provision_social_flow`

## Detalhes técnicos

- Zero migrations, zero mudança de schema
- Reaproveita `ZERNIO_API_KEY` (já configurada)
- Helper compartilhado evita duplicação entre `create` e `provision`
- Edge function `zernio-provision-flow` continua existindo como fallback manual (não remover)
- Tools/UI de social flows no frontend não são alteradas

## Arquivos tocados

- `supabase/functions/smart-ops-copilot/index.ts` (única edição)
