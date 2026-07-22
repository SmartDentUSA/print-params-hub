## Objetivo

Adicionar adaptador de webhook da Zernio para Meta Lead Ads e promover o normalizador de campos (`_shared/zernio-field-normalizer.ts`) a padrão único do sistema — usado tanto pela nova função Zernio quanto pela `smart-ops-meta-lead-webhook` nativa, antes do envio ao `smart-ops-ingest-lead`.

Não altero: `LeadDetailPanel.tsx`, schema de `lead_activity_log`, contratos PipeRun/SellFlux, verificação de assinatura Meta, lógica anti-redelivery do webhook nativo, chamada à Graph API.

## Passos

### 1. Migration
Criar `public.zernio_leadgen_dedup` (PK `leadgen_id`, colunas `zernio_lead_id`, `first_delivery_id`, `lead_id`, `processed_at`) com GRANTs para `service_role` (RLS habilitada, sem policies — acesso só via service role das edge functions).

### 2. Arquivo compartilhado
Criar `supabase/functions/_shared/zernio-field-normalizer.ts` exatamente com o conteúdo especificado — slugify accent-safe, enums canônicos (área de atuação, especialidade, scanner com fallback de marca, impressora), `FORM_ID_TO_PRODUCT` (19 form_ids Meta), `metaFieldDataArrayToRecord` (ponte para o formato Graph API), e `normalizeZernioLead` como entry point.

### 3. Nova edge function
Criar `supabase/functions/smart-ops-zernio-lead-webhook/index.ts` conforme spec: verificação HMAC-SHA256 via `ZERNIO_WEBHOOK_SECRET`, dedup por `payload.lead.leadgenId` (idempotente via PK conflict 23505), normalização, chamada a `smart-ops-ingest-lead` com `source: "meta_lead_ads"`, update do `lead_id` retornado. Registrar em `supabase/config.toml` com `verify_jwt = false`.

### 4. Ajuste no webhook Meta nativo
Em `smart-ops-meta-lead-webhook/index.ts`, entre a chamada Graph API (`field_data`) e o `fetch` para `smart-ops-ingest-lead` (linhas ~107 e ~236), inserir:
- `const fieldsRecord = metaFieldDataArrayToRecord(fieldData);`
- `const normalized = normalizeZernioLead(fieldsRecord);`
- `const productMapping = mapFormToProduct(formId);`

Substituir no `normalizedPayload` os campos derivados dos canonicalizadores locais (`canonicalizeArea/Specialty/Scanner/Printer` no bloco IIFE das linhas 192-217) pelos equivalentes do normalizer novo (`normalized.areaAtuacao`, `normalized.especialidade`, `normalized.scanner.label`, `normalized.impressora.label`). Se `productMapping` existir e `produtoInteresse` for null, usar `productMapping.productName`. Adicionar `needs_manual_review: normalized.needsManualReview`. Preservar: cascade de `originLabel`, campos meta_*, campos empresa/cidade/uf, `produto_interesse_auto`, keywords para `lead_form_submissions`, todo o restante da função.

### 5. Secret
Após deploy da nova function (para o usuário ter a URL de callback), pedir `add_secret ZERNIO_WEBHOOK_SECRET` — o usuário gera o valor forte e cola tanto aqui quanto no registro do webhook Zernio (shared secret).

### 6. Registro do webhook na Zernio + teste GET /ads/leads
Instrução no chat para o usuário rodar (não faço eu): `POST /v1/webhooks/settings` com URL `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-zernio-lead-webhook`, event `lead.received`, mesmo secret; e `GET /v1/ads/leads?limit=1` com Bearer da API key da Zernio para confirmar habilitação (200 ok / 403 add-on / 401 key).

## Ordem de execução em build mode
1. `supabase--migration` (tabela dedup)
2. Criar `_shared/zernio-field-normalizer.ts`
3. Criar `smart-ops-zernio-lead-webhook/index.ts` + entrada em `config.toml`
4. Editar `smart-ops-meta-lead-webhook/index.ts` (só o bloco de normalização, sem tocar assinatura/anti-redelivery/Graph)
5. `add_secret ZERNIO_WEBHOOK_SECRET`
6. Instruções finais no chat (registro webhook + teste GET)

## Detalhes técnicos / riscos

- **Dedup Zernio é local à Zernio** — não reconcilia com o leadgen nativo. Se ambos webhooks entregarem o mesmo lead, `smart-ops-ingest-lead` resolve por identidade (phone/email) e faz update. Com o normalizer padronizado nos dois lados, o registro final fica consistente independente da ordem de chegada.
- **`FORM_ID_TO_PRODUCT` vs cascade existente**: a cascade atual do webhook nativo (`directProduct → inferredProduct → campaignProduct`) fica preservada; `productMapping.productName` entra como novo fallback quando os três forem null.
- **Canonicalizadores antigos** (`canonicalizeArea/Specialty/Scanner/Printer` em `_shared/meta-field-utils.ts`) continuam no repo para não quebrar outros callers; o webhook nativo passa a usar o normalizer novo, mas mantenho os campos `scanner_marca`, `tem_scanner`, `tem_impressora`, `como_digitaliza` derivados do resultado novo (label + status) para não regredir colunas do `lia_attendances`.
- **`verify_jwt = false`** na nova function (webhook público autenticado por HMAC próprio).
- **Sem alteração no schema de `lia_attendances`** — `needs_manual_review` viaja no payload do ingest-lead; se a coluna não existir, o auto-forward do ingest preserva em `raw_payload` (comportamento atual do gateway).