

# Plano: WhatsApp Inbox Listener + Pipeline Reactivator Loop

## Diagnostico do Estado Atual

| Componente | Status | Onde |
|------------|--------|------|
| Hunter (Proactive Outreach) | EXISTE | `smart-ops-proactive-outreach/index.ts` — 4 regras, SellFlux + WaLeads |
| Sentinela (Webhook Listener) | NAO EXISTE | Nenhum endpoint recebe respostas do WaLeads |
| `whatsapp_inbox` | NAO EXISTE | Sem tabela de mensagens inbound |
| `classifyMessage` | NAO EXISTE | Sem classificador de intencao |
| `notifySeller` | EXISTE PARCIAL | `notifySellerEscalation` no dra-lia (apenas escalation, sem hot-lead alert) |
| Phone normalization | EXISTE PARCIAL | `normalizePhone` no `smart-ops-ingest-lead` (remove nao-digitos, adiciona 55) |
| Cognitive Analysis | EXISTE | `cognitive-lead-analysis/index.ts` deployado |

**Gap critico**: O Hunter dispara mensagens via WaLeads/SellFlux, mas nao existe endpoint para capturar as respostas. O loop esta aberto.

---

## Fase 1: Tabela `whatsapp_inbox`

Tabela separada de `lia_attendances` para auditoria, retreinamento e performance.

```sql
CREATE TABLE IF NOT EXISTS whatsapp_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  phone text NOT NULL,
  phone_normalized text,
  message_text text,
  media_url text,
  media_type text,
  direction text NOT NULL DEFAULT 'inbound' CHECK (direction IN ('inbound', 'outbound')),
  lead_id uuid REFERENCES lia_attendances(id),
  matched_by text,
  intent_detected text CHECK (intent_detected IS NULL OR intent_detected IN (
    'interesse_imediato', 'interesse_futuro', 'pedido_info',
    'objecao', 'sem_interesse', 'suporte', 'indefinido'
  )),
  confidence_score integer,
  seller_notified boolean DEFAULT false,
  processed_at timestamptz,
  raw_payload jsonb DEFAULT '{}'
);

CREATE INDEX idx_wainbox_phone ON whatsapp_inbox(phone_normalized);
CREATE INDEX idx_wainbox_lead ON whatsapp_inbox(lead_id);
CREATE INDEX idx_wainbox_intent ON whatsapp_inbox(intent_detected);
CREATE INDEX idx_wainbox_created ON whatsapp_inbox(created_at DESC);
```

RLS: `admin_only` (mesma policy de `lia_attendances`).

---

## Fase 2: Edge Function `smart-ops-wa-inbox-webhook`

Endpoint publico que recebe POST do WaLeads quando lead responde.

**Fluxo:**

1. Recebe payload WaLeads (formato: `{ phone, message, media_url, ... }`)
2. Normaliza telefone (ultimos 8-9 digitos para match)
3. Busca lead em `lia_attendances` via `telefone_normalized`
4. Classifica mensagem (rule-based v1):
   - `interesse_imediato`: regex para "quero", "fechar", "parcelamento", "proposta", "quando entrega"
   - `interesse_futuro`: "estou planejando", "semestre", "ano que vem"
   - `pedido_info`: "catalogo", "preco", "como funciona", "diferenca"
   - `objecao`: "caro", "vou pensar", "falar com socio"
   - `sem_interesse`: "nao tenho interesse", "pare", "remover"
   - `suporte`: "problema", "defeito", "troca", "garantia"
5. Insere em `whatsapp_inbox`
6. Se `interesse_imediato` ou `interesse_futuro`: notifica vendedor responsavel
7. Se `sem_interesse`: atualiza `tags_crm` com `A_SEM_RESPOSTA`
8. Se lead tem 5+ msgs: dispara `cognitive-lead-analysis` fire-and-forget

**Config:** `[functions.smart-ops-wa-inbox-webhook] verify_jwt = false`

---

## Fase 3: Funcao de Normalizacao de Telefone (Robusta)

Criar helper `normalizePhoneForMatch` no `_shared/sellflux-field-map.ts`:

```typescript
export function normalizePhoneForMatch(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  // Extrair ultimos 8-9 digitos para match
  return digits.length >= 8 ? digits.slice(-9) : digits;
}

export function matchPhoneLoose(a: string, b: string): boolean {
  const na = normalizePhoneForMatch(a);
  const nb = normalizePhoneForMatch(b);
  return na.length >= 8 && nb.length >= 8 && (na.endsWith(nb) || nb.endsWith(na));
}
```

O webhook usara ILIKE `%ultimos9digitos` no `telefone_normalized` para encontrar o lead.

---

## Fase 4: Notificacao do Vendedor (Hot Lead Alert)

Quando `intent_detected === 'interesse_imediato'`:

1. Buscar `proprietario_lead_crm` em `lia_attendances`
2. Buscar `team_member` correspondente
3. Enviar mensagem via WaLeads/SellFlux para o vendedor:

```
OPORTUNIDADE QUENTE
Lead: {nome} ({especialidade})
Owner: {proprietario_lead_crm}
Resposta: "{message_text}" (truncado 200 chars)
Etapa CRM: {ultima_etapa_comercial}
Analise Cognitiva: {lead_stage_detected} | Urgencia: {urgency_level}
Acao: {recommended_approach}
```

4. Marcar `seller_notified = true` em `whatsapp_inbox`

---

## Fase 5: Limpeza Automatica (Clean-up Job)

Adicionar logica no `smart-ops-stagnant-processor` existente:

- Quando `intent_detected === 'sem_interesse'` em `whatsapp_inbox` nos ultimos 7 dias
- E lead nao tem outras interacoes positivas
- Atualizar `lead_status = 'descartado'` e adicionar tag `A_SEM_RESPOSTA`

---

## Resumo de Arquivos

| # | Arquivo | Acao |
|---|---------|------|
| 1 | Migracao SQL | Nova tabela `whatsapp_inbox` + indices + RLS |
| 2 | `supabase/functions/smart-ops-wa-inbox-webhook/index.ts` | NOVO (~150 linhas) |
| 3 | `supabase/functions/_shared/sellflux-field-map.ts` | +2 funcoes de normalizacao de telefone |
| 4 | `supabase/config.toml` | +3 linhas para nova funcao |
| 5 | `supabase/functions/smart-ops-stagnant-processor/index.ts` | +15 linhas para clean-up de `sem_interesse` |

## Ordem de Execucao

```text
1. Migracao SQL (whatsapp_inbox)
2. Helpers de normalizacao em sellflux-field-map.ts
3. Edge function smart-ops-wa-inbox-webhook + config.toml
4. Integracao clean-up no stagnant-processor
5. Deploy
```

## Payload WaLeads Esperado

O webhook do WaLeads envia POST com:

```json
{
  "event": "message_received",
  "phone": "5511999887766",
  "message": "Tenho interesse sim, como funciona?",
  "media_url": null,
  "timestamp": "2026-02-26T10:30:00Z"
}
```

O endpoint a ser configurado no painel WaLeads sera:
`https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-wa-inbox-webhook`

