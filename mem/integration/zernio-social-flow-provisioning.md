---
name: Provisionamento de flows IG DM na Zernio
description: Flow em social_flows só dispara DM se tiver zernio_automation_id; zernio-provision-flow tem modo lote (batch)
type: feature
---
- Criar o flow em `social_flows` (via `zernio-dm-flows-sync`) **não** faz a Zernio escutar comentários.
  Sem `zernio_automation_id` nenhum evento chega em `zernio-webhook` e o usuário não recebe DM.
- `zernio-provision-flow` (verify_jwt=false) cria a automação de comentário na Zernio
  (`POST https://zernio.com/api/v1/comment-automations`, `profileId 6a1e1a2368fd70c014724ef0`,
  `accountId 6a1e1b992b2567671a925559`, `matchMode: contains`) e grava o id no flow.
- Modos: `{"flow_id":"..."}` (individual) ou `{"batch":true,"limit":60}` — o lote percorre flows
  `channel='instagram' AND is_active AND zernio_automation_id IS NULL` com `keywords` preenchidas.
- Flows sem `keywords` (Novo Seguidor, Menção) são ignorados no lote: usam outro tipo de trigger.
- Depois de rodar `zernio-dm-flows-sync`, **sempre** rodar o provisionamento em lote, senão as
  palavras-gatilho ficam inertes.
