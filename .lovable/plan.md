

## Plano: Receber Leads de Facebook/Instagram/TikTok Ads direto no `smart-ops-ingest-lead`

### Como funciona hoje

O `smart-ops-ingest-lead` já é um endpoint público (`verify_jwt = false`) que aceita POST JSON genérico. O problema: ele tem um bug (`source` não declarado na linha 80) e não normaliza payloads de plataformas de ads.

### Como as plataformas de ads enviam leads

Cada plataforma usa **Webhooks** quando alguém preenche um Lead Form:

| Plataforma | Mecanismo | Formato do Payload |
|---|---|---|
| **Meta (FB/IG)** | Webhooks API via App ou Zapier/Make | `leadgen_id` → precisa chamar Graph API para pegar dados reais |
| **TikTok Ads** | Lead Connector Webhook | JSON direto com campos do formulário |

**Problema com Meta**: O webhook do Meta Lead Ads **não envia os dados do lead diretamente**. Ele envia apenas `{ leadgen_id, page_id, form_id }`. Você precisa chamar a Graph API para buscar os dados reais. Isso exige um **Meta Access Token**.

### Arquitetura proposta

```text
Meta Lead Ad webhook ──→ smart-ops-meta-lead-webhook ──→ Graph API (busca dados)
                                                              │
TikTok Lead webhook ────────────────────────────────────────→ │
                                                              ▼
                                                    smart-ops-ingest-lead
                                                    (gateway centralizado)
```

### Implementação (3 passos)

**1. Nova Edge Function: `smart-ops-meta-lead-webhook`**
- Recebe POST do Meta Webhooks (`leadgen_id`, `page_id`, `form_id`)
- Implementa verificação do webhook Meta (GET com `hub.verify_token` + `hub.challenge`)
- Chama `GET https://graph.facebook.com/v21.0/{leadgen_id}?access_token=...` para buscar dados reais (nome, email, telefone, campos customizados)
- Normaliza o payload para o formato padrão e chama `smart-ops-ingest-lead` internamente
- Marca `source = "meta_lead_ads"` e `utm_source = "facebook"` ou `"instagram"`

**2. Adaptar `smart-ops-ingest-lead` para TikTok direto**
- TikTok envia JSON com campos diretos, então o `extractField` flexível já funciona
- Adicionar mapeamento de campos TikTok: `"user_name"`, `"user_phone"`, `"user_email"`
- Corrigir bug da variável `source` (linha 80): declarar `const source = payload.source || payload.utm_source || "formulario"`
- Adicionar detecção automática de plataforma via headers/payload

**3. Corrigir `smart-ops-ingest-lead` (merge inteligente)**
- Antes do upsert, buscar lead existente por email
- Implementar merge: só preencher campos `null` (não sobrescrever dados existentes)
- Remover criação direta de deal PipeRun (delegar ao `lia-assign`)
- Adicionar fire-and-forget para `lia-assign` e `cognitive-lead-analysis`

### Secret necessário

- `META_LEAD_ADS_TOKEN`: Access Token do Meta (Page Token com permissão `leads_retrieval` e `pages_manage_ads`)
- `META_WEBHOOK_VERIFY_TOKEN`: Token customizado para verificação do webhook Meta

### Config no painel das plataformas

| Plataforma | URL do Webhook |
|---|---|
| **Meta (FB/IG)** | `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-meta-lead-webhook` |
| **TikTok Ads** | `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-ingest-lead` (direto, com `source=tiktok_ads`) |

### Arquivos

| # | Arquivo | Acao |
|---|---------|------|
| 1 | `supabase/functions/smart-ops-meta-lead-webhook/index.ts` | NOVO — recebe webhook Meta, busca dados via Graph API, repassa ao ingest-lead |
| 2 | `supabase/functions/smart-ops-ingest-lead/index.ts` | REFATORAR — fix bug `source`, merge inteligente, mapeamento TikTok, fire-and-forget orquestração |
| 3 | `supabase/config.toml` | +3 linhas para `smart-ops-meta-lead-webhook` |

