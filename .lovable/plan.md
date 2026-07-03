## Objetivo
Adicionar canal **📧 Email (Gmail)** na Central de Campanhas com **gerador de email por IA** (mesmo padrão do gerador de mensagens de grupos WhatsApp) e **tracking de abertura + clique**.

---

## 1. UI — novo canal Email em `SmartOpsCampaigns.tsx`

Novo item no Select de canal: `email` → "📧 Email (Gmail)".

Quando `sendChannel === "email"`, o passo 2 mostra o **Email Composer**:

### 1a. Bloco "Conteúdo base" (reuso do padrão do CampaignLinkPicker)
- **Produto** (Select): lista `products_catalog` / `system_a_catalog` (mesma fonte usada em `useProductKnowledgeCopies`).
- **Call-to-Action principal** (Select dinâmico por produto): 
  - Landing Page (de `smartops_form_landing_pages` + páginas de conhecimento)
  - Formulário (`smartops_forms`)
  - Publicação de conhecimento (`knowledge_contents`)
  - Post Instagram / rede social (`social_scheduled_posts` publicados + `social_posts`)
  - Link da loja (system_a_catalog.product_url)
  - Link direto do WhatsApp do vendedor responsável (por lead)
- **CTAs secundários** (multi-select): mesma lista acima, permite adicionar até 3 blocos extras (botões/links no rodapé do email).
- **Assinatura** (Select): vendedor fixo, dono do lead (dinâmico por destinatário), ou remetente único.

### 1b. Botão **"Gerar com IA"**
Payload → edge function `smart-ops-generate-email-ai`:
```
{ produto, cta_principal: {tipo, id, url}, ctas_secundarios, segmento_resumo, tom }
```
IA (Lovable AI, `google/gemini-3-flash-preview`) retorna:
```
{ subject, preheader, html_body, plain_text, cta_button_label }
```
Prompt system: monta email profissional dental, mencionando os benefícios do produto extraídos do catálogo (system_a_catalog), com o CTA como botão principal + CTAs secundários como links no rodapé. Substitui `{{nome}}`, `{{vendedor_nome}}`, `{{link_wa_vendedor}}` como placeholders.

### 1c. Editor
- Assunto (input) + Preheader (input)
- Corpo HTML (Textarea grande com preview lado-a-lado)
- Botão "Regerar", "Regerar só assunto", "Adicionar imagem" (upload → storage `email-assets`, mesmo bucket já usado em auth emails)
- Preview real usando um lead de exemplo do segmento.

---

## 2. Backend — edge functions novas

### 2a. `smart-ops-generate-email-ai`
- Recebe produto + CTAs + segmento, busca dados do produto no `system_a_catalog` (título, benefícios, imagem, url).
- Chama Lovable AI Gateway com system prompt de copy dental (mesmo padrão do gerador de WhatsApp).
- Retorna `{ subject, preheader, html_body, plain_text, cta_button_label }`.
- **Nunca inclui preços** (regra Core: Content Generation).

### 2b. `smart-ops-send-gmail`
- Auth JWT admin. Reusa segmentação existente (`lia_attendances`, `merged_into IS NULL`, força `email IS NOT NULL`).
- Cria registro em `campaigns` com `channel='email'` e uma linha por destinatário em `campaign_send_log`.
- Para cada destinatário:
  1. Substitui placeholders (`{{nome}}`, `{{vendedor_nome}}`, `{{link_wa_vendedor}}` do responsável do lead).
  2. **Reescreve todos os links** para `https://smartdent.com.br/r/{short_id}` (via `short_links` já existente) → habilita tracking de clique.
  3. Injeta **pixel de abertura** `<img src="https://.../functions/v1/email-track-open?m={message_id}" width="1" height="1"/>` no fim do HTML.
  4. Envia via **connector gateway Gmail**: `POST /google_mail/gmail/v1/users/me/messages/send` com RFC 2822 (Content-Type text/html) base64url.
  5. Grava `provider_message_id`, `status`, `sent_at`.
- Rate limit: 1 req / 300ms (respeita quota Gmail).

### 2c. `email-track-open` (GET público)
- Recebe `m={message_id}`, marca `campaign_send_log.opened_at = now()` (se null), retorna GIF 1×1.
- Ignora cache (headers `Cache-Control: no-store`).

### 2d. `short-link-redirect` (já existe? senão criar)
- Marca `campaign_send_log.clicked_at` + incrementa contador `short_links.clicks` + `campaign_send_log.click_count`, e redireciona 302 para URL destino.

---

## 3. Schema — migração

Adicionar em `campaign_send_log`:
- `opened_at TIMESTAMPTZ NULL`
- `clicked_at TIMESTAMPTZ NULL`
- `click_count INT DEFAULT 0`
- `email_subject TEXT NULL`
- `provider_message_id TEXT NULL`

Adicionar em `campaigns` (ou `smart_ops_campaigns` conforme a tabela realmente usada — vou confirmar antes):
- `email_html TEXT NULL`, `email_subject TEXT NULL`, `email_preheader TEXT NULL`
- `cta_config JSONB NULL` (guarda produto + CTAs escolhidos, para reproduzir)
- Índices em `campaign_id`, `opened_at`, `clicked_at`.

Grants padrão + RLS: `authenticated` só lê registros de suas campanhas; `service_role` full. `email-track-open` e `short-link-redirect` usam service role internamente.

---

## 4. Analytics — nova aba "Métricas Email" na campanha
Após envio, mostra:
- Enviados / Entregues / Falhas
- **Taxa de abertura** = opened / delivered
- **CTR** = clicked / opened
- Top CTAs clicados (ranking por `short_link.destination_type`)
- Timeline de aberturas (últimas 24h)

Fontes: agrega `campaign_send_log` por `campaign_id`. Reusa componentes de `SmartOpsSmartFlowAnalytics`.

---

## 5. Regras preservadas
- CDP Integrity (`merged_into IS NULL`).
- Content Generation policy: sem preços no HTML gerado.
- Commercial Intent Guard: envio de email **não** cria Deal PipeRun.
- Person Origin Frozen: nenhum overwrite.
- Nada de secret Gmail no browser — tudo via connector gateway.

---

## Detalhes técnicos
- Conector Gmail já conectado → `GOOGLE_MAIL_API_KEY` + `LOVABLE_API_KEY` disponíveis nas edges.
- Scope Gmail necessário: `gmail.send`. Se 403 "insufficient scopes", UI mostra toast pedindo reconectar.
- Limite Gmail: ~500 envios/dia conta free / 2000 Workspace. UI alerta se público > limite e sugere fatiar em dias.
- Bucket `email-assets` (público, read-only) para imagens do corpo.
- Pixel + short-link são a única forma prática de tracking no Gmail (não expõe read receipts). Aberturas ficam sub-reportadas em clientes que bloqueiam imagens (esperado; documentado no tooltip da métrica).

---

## Fora deste plano
- A/B testing de assunto.
- Rotação entre múltiplas contas Gmail.
- Templates HTML salvos reutilizáveis (fica p/ iteração seguinte, mas o `cta_config JSONB` já permite "duplicar campanha").

Confirma que sigo por aqui?