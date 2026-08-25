---
name: Flows IG DM por palavra-gatilho dos formulários
description: zernio-dm-flows-sync cria 1 social_flow por formulário com ig_trigger_keyword; DM sem placeholders, respostas públicas variadas, link do formulário (só exocad RMS usa landing page)
type: feature
---
- EF `zernio-dm-flows-sync` (verify_jwt=false) percorre `smartops_forms` com `ig_trigger_keyword` (ativos e inativos), garante link curto via RPC `generate_short_link` e faz upsert em `social_flows` por `form_name = slug`.
- **Link**: só `exocad_dentalcad_rms` aponta para `landing_page` (`LANDING_PAGE_SLUGS`); todos os outros usam o link curto do **formulário** até as LPs ficarem prontas.
- **A Zernio NÃO interpola variáveis**: qualquer `{{first_name}}`/`{{nome}}` chega literal ao usuário. `dm_message` e `comment_reply` são gerados sem placeholders, e `zernio-provision-flow` ainda aplica `stripPlaceholders` (colapsa só espaços/tabs, preserva `\n`) antes de enviar.
- **Resposta pública ao comentário nunca pede a palavra de novo** (o usuário já escreveu). São 4 variações do tipo "Acabei de mandar as informações na sua DM! 📩", rotacionadas pela Zernio via `commentReplyVariations`. Não usar `ig_trigger_cta` como resposta (esse campo é só para copy de posts).
- `zernio_automation_config` guarda `keywords`, `dm_message`, `dm_message_variations` (2), `comment_reply`, `comment_reply_variations` (3), `short_link`, `short_link_target`, `form_slug`.
- `social_triggers` recebe 2 linhas por flow: `comment_keyword` e `dm_keyword`.
- `zernio-provision-flow`: `{batch:true}` cria os pendentes; `{batch:true, resync:true}` faz **PATCH** nas automações já existentes (obrigatório depois de qualquer mudança de texto/link). UI: botões "Sincronizar formulários" e "Enviar para Zernio" em `SocialFlowsList`.
- Sync/resync podem exceder o timeout do gateway com ~48 formulários, mas continuam rodando no servidor e são idempotentes.
