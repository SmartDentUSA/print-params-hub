---
name: Flows IG DM por palavra-gatilho dos formulários
description: zernio-dm-flows-sync cria 1 social_flow por formulário com ig_trigger_keyword, enviando DM com link encurtado (LP publicada > formulário)
type: feature
---
- EF `zernio-dm-flows-sync` (verify_jwt=false) percorre `smartops_forms` com `ig_trigger_keyword` (ativos e inativos), garante link curto via RPC `generate_short_link` (`landing_page` se LP publicada, senão `form`), e faz upsert em `social_flows` por `form_name = slug`.
- Nodes gerados: `send_dm` (mensagem "Olá {{first_name}}, que bom que se interessou pelo <produto>… Link: <s.smartdent.com.br/xxx>") → `end`. `zernio_automation_config` guarda `keywords`, `dm_message`, `comment_reply`, `short_link`, `short_link_target`, `form_slug`.
- `social_triggers` recebe 2 linhas por flow: `comment_keyword` e `dm_keyword` com a mesma palavra.
- Flow fica `is_active` só se o formulário está ativo e `ig_trigger_enabled != false`. Formulário inativo → flow criado desativado.
- `zernio-webhook` injeta `ig_username`, `nome` e `first_name` no `state` da sessão para o template da DM.
- UI `SocialFlowsList` tem botão "Sincronizar formulários" + badges de gatilho, link curto e preview da DM.
- Rodar a sync pode exceder o timeout do gateway com 48 formulários: é idempotente, basta reexecutar.
