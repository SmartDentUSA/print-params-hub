# Revenue Intelligence OS — WhatsApp Loop & Pipeline Sync

**Última atualização:** 2026-03-06
**Escopo:** Fechamento do loop WhatsApp (Hunter → Sentinela → Reativação) + correções de produção

---

## 1. Visão Geral da Arquitetura

```
                    ┌──────────────────────────────────────┐
                    │          Fontes de Entrada            │
                    │  WaLeads · SellFlux · Meta Leads     │
                    │  PipeRun · Loja Integrada · Astron   │
                    └──────────────┬───────────────────────┘
                                   │ webhook POST
                    ┌──────────────▼───────────────────────┐
                    │      Edge Functions (Supabase)        │
                    │                                       │
                    │  smart-ops-wa-inbox-webhook ─────┐    │
                    │  dra-lia-whatsapp ───────────────┤    │
                    │  smart-ops-meta-lead-webhook     │    │
                    │  smart-ops-piperun-webhook       │    │
                    │  smart-ops-ecommerce-webhook     │    │
                    │  smart-ops-sellflux-webhook      │    │
                    └──────────────┬───────────────────┘    │
                                   │                        │
                    ┌──────────────▼───────────────────┐    │
                    │     CDP: lia_attendances          │    │
                    │     (~200 colunas)                │    │
                    │     Fonte única de verdade        │    │
                    └──────────────┬───────────────────┘    │
                                   │                        │
              ┌────────────────────┼────────────────┐       │
              │                    │                │       │
   ┌──────────▼──────┐  ┌─────────▼───────┐ ┌──────▼──────┐│
   │  whatsapp_inbox  │  │ agent_sessions  │ │ agent_      ││
   │  (msg audit log) │  │ (state machine) │ │ interactions││
   └──────────────────┘  └─────────────────┘ └─────────────┘│
                                                             │
                    ┌────────────────────────────────────────┘
                    │
       ┌────────────▼────────────┐
       │    Processadores Async   │
       │                          │
       │  stagnant-processor      │
       │  proactive-outreach      │
       │  cognitive-lead-analysis │
       │  batch-cognitive-analysis│
       └──────────────────────────┘
```

---

## 2. Componentes Implementados

### 2.1 `dra-lia-whatsapp` — Agente Autônomo WhatsApp

**Arquivo:** `supabase/functions/dra-lia-whatsapp/index.ts` (540 linhas)
**JWT:** `false` (recebe webhooks externos)

**Fluxo completo:**

1. Recebe POST de qualquer provedor (WaLeads, ChatCenter, Z-API, genérico)
2. Extrai `phone`, `messageText`, `senderName` de payload flexível (~15 campos mapeados)
3. Resolve `@lid` do WhatsApp (IDs internos → telefone real via campos alternativos)
4. Aplica 4 camadas de dedup:
   - `fromMe` / `isGroup` → ignora
   - `lastMessageDate` > 2 min → ignora (mensagem stale)
   - Mesmo `phone + message_text` nos últimos 5 min → ignora
   - Último outbound < 30s → ignora (anti-loop)
5. Busca lead em `lia_attendances` via `ILIKE %ultimos9digitos`
6. Se não encontra, cria lead placeholder (`wa_PHONE_TIMESTAMP@whatsapp.lead`)
7. Recupera histórico via `agent_interactions.session_id = "wa_PHONEDIGITS"` (últimas 10)
8. Filtra do histórico mensagens da IA pedindo e-mail (anti email-loop)
9. Pre-seed `agent_sessions` com `extracted_entities: { lead_id, lead_name, lead_email }` — **NÃO escreve `lead_id` na coluna FK** (apontava para `leads.id`, causava violação)
10. Chama `dra-lia` via SSE stream (timeout 45s)
11. Response Guard: intercepta respostas da IA que pedem e-mail para lead já conhecido → substitui por saudação
12. Formata para WhatsApp (strip markdown, max 4000 chars)
13. Envia via `smart-ops-send-waleads` (resolve `team_member` por owner → fallback)
14. Persiste inbound em `whatsapp_inbox`

### 2.2 `smart-ops-wa-inbox-webhook` — Classificador de Intenção

**Arquivo:** `supabase/functions/smart-ops-wa-inbox-webhook/index.ts` (285 linhas)
**JWT:** `false`

**Propósito:** Recebe respostas do WaLeads para mensagens de **campanhas** (não do agente autônomo). Classifica e notifica vendedores.

**Classificador de intenção (rule-based v1):**

| Intent               | Exemplos                                          | Confiança |
|----------------------|---------------------------------------------------|-----------|
| `interesse_imediato` | quero, fechar, parcelamento, proposta              | 90%       |
| `interesse_futuro`   | planejando, semestre, avaliando                    | 75%       |
| `pedido_info`        | catálogo, preço, como funciona, ficha técnica      | 80%       |
| `objecao`            | caro, vou pensar, falar com sócio                  | 70%       |
| `sem_interesse`      | não tenho interesse, pare, remover                 | 95%       |
| `suporte`            | problema, defeito, garantia                        | 85%       |
| `indefinido`         | fallback                                           | 20%       |

**Ações pós-classificação:**

- `interesse_imediato` ou `interesse_futuro`: Hot Lead Alert → notifica vendedor via WaLeads
- `sem_interesse`: adiciona tag `A_SEM_RESPOSTA` em `lia_attendances`
- Lead com 5+ mensagens: dispara `cognitive-lead-analysis` (fire-and-forget)

### 2.3 `smart-ops-stagnant-processor` — Motor de Estagnação

**Arquivo:** `supabase/functions/smart-ops-stagnant-processor/index.ts` (345 linhas)

**Pipeline de estagnação:**
```
est_etapa1 → est_etapa2 → est_etapa3 → est_etapa4 → est_apresentacao → est_proposta → estagnado_final
```

Cada avanço ocorre após 5 dias de inatividade. Inclui:

- Decisão estratégica via DeepSeek (max 20 leads/run)
- Geração de mensagem de reativação via Gemini Flash Lite
- Envio via SellFlux (preferencial) ou ManyChat (fallback)
- Push da etapa para PipeRun via `moveDealToStage`
- **Clean-up `sem_interesse`:** busca em `whatsapp_inbox` (últimos 7 dias), descarta leads sem interações positivas

### 2.4 `smart-ops-sync-piperun` — Sincronização Bidirecional

**Arquivo:** `supabase/functions/smart-ops-sync-piperun/index.ts` (291 linhas)

- **Modo orquestrador** (`?orchestrate=true`): itera 11 pipelines sequencialmente
- **Modo pipeline único** (`?pipeline_id=X`): sincroniza um funil
- Smart merge: não sobrescreve campos existentes com `null`
- Detecção de transição estagnado ↔ resgatado

### 2.5 Tabela `whatsapp_inbox`

```sql
CREATE TABLE whatsapp_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  phone text NOT NULL,
  phone_normalized text,
  message_text text,
  media_url text,
  media_type text,
  direction text NOT NULL DEFAULT 'inbound'
    CHECK (direction IN ('inbound', 'outbound')),
  lead_id uuid REFERENCES lia_attendances(id),
  matched_by text,
  intent_detected text CHECK (intent_detected IS NULL OR intent_detected IN (
    'interesse_imediato', 'interesse_futuro', 'pedido_info',
    'objecao', 'sem_interesse', 'suporte', 'indefinido',
    'lia_autonomous'
  )),
  confidence_score integer,
  seller_notified boolean DEFAULT false,
  processed_at timestamptz,
  raw_payload jsonb DEFAULT '{}'
);

-- Índices
CREATE INDEX idx_wainbox_phone ON whatsapp_inbox(phone_normalized);
CREATE INDEX idx_wainbox_lead ON whatsapp_inbox(lead_id);
CREATE INDEX idx_wainbox_intent ON whatsapp_inbox(intent_detected);
CREATE INDEX idx_wainbox_created ON whatsapp_inbox(created_at DESC);
```

---

## 3. Bugs Encontrados e Corrigidos

### 3.1 `@lid` — WhatsApp Internal ID Resolution

**Problema:** O WhatsApp envia `phone` como `XXXXXXXXXXX@lid` (ID interno da Meta) em vez do número real. O sistema criava leads com telefone inválido e não conseguia fazer match.

**Correção:** Ambos `dra-lia-whatsapp` e `wa-inbox-webhook` agora:
1. Detectam `@lid` no `phone` ou dígitos > 13
2. Buscam telefone real em campos alternativos: `senderPn`, `remoteJidAlt`, `participant` (incluindo nested em `data`, `key`, `_data.key`)
3. Validam que o alternativo tem 10-15 dígitos
4. Logam a resolução para auditoria

**Arquivos:** `dra-lia-whatsapp/index.ts:49-65`, `wa-inbox-webhook/index.ts:103-120`

### 3.2 `session_id` Estável

**Problema:** O `session_id` era gerado como UUID aleatório a cada mensagem. O histórico nunca era recuperado porque cada mensagem iniciava uma sessão nova.

**Correção:** `session_id` agora é determinístico: `wa_${phoneDigits}`. Garante que todas as mensagens do mesmo número compartilham a mesma sessão.

**Arquivo:** `dra-lia-whatsapp/index.ts:329`

### 3.3 History Query — `session_id` em vez de `lead_id`

**Problema:** A query ao `agent_interactions` usava `lead_id`, mas esse campo frequentemente era `null` porque o `dra-lia` core não resolvia o lead da mesma forma.

**Correção:** Query usa `.eq("session_id", sessionId)` que é sempre preenchido.

**Arquivo:** `dra-lia-whatsapp/index.ts:332-347`

### 3.4 `agent_sessions` FK Violation

**Problema:** O upsert em `agent_sessions` escrevia `lia_attendances.id` na coluna `lead_id`, que tem FK para `public.leads` (tabela diferente). Causava `insert or update on table "agent_sessions" violates foreign key constraint`.

**Correção:** O `lead_id` é passado apenas dentro de `extracted_entities` (JSONB), não na coluna FK. O `current_state` é setado como `"chatting"` para pular o fluxo de coleta.

**Arquivo:** `dra-lia-whatsapp/index.ts:357-376`

### 3.5 Email-Loop Guard (Response Guard + History Filter)

**Problema:** Mesmo com lead conhecido, a LIA continuava pedindo e-mail porque: (a) o histórico continha mensagens anteriores onde ela pedia e-mail, reforçando o padrão; (b) o LLM gerava novas solicitações de e-mail por inércia.

**Correção (dupla camada):**
1. **History Filter** (linha 351-353): Remove do histórico enviado ao LLM qualquer mensagem `assistant` que contenha regex de e-mail + solicitação
2. **Response Guard** (linha 421-424): Se a resposta final do LLM contém padrão de solicitação de e-mail para lead já conhecido, substitui por: `"{nome}, já te reconheci por aqui ✅\n\nComo posso te ajudar agora?"`

### 3.6 `sync-piperun` HTML Crash

**Problema:** Quando uma sub-chamada do orquestrador retornava timeout/erro (HTML em vez de JSON), `res.json()` falhava com `SyntaxError: Unexpected token '<'`.

**Correção:** Validação de `Content-Type` antes de `res.json()`. Se não é `application/json`, captura preview do texto e continua/retorna 502.

**Arquivo:** `smart-ops-sync-piperun/index.ts:118-124, 157-163`

---

## 4. Fluxo Completo do Loop (Hunter → Sentinela → Reativação)

```
┌─ HUNTER (proactive-outreach) ─────────────────────────────────┐
│  4 regras: boas-vindas, follow-up 3d, follow-up 7d, suporte  │
│  Envia via SellFlux + WaLeads                                 │
└──────────────────────┬────────────────────────────────────────┘
                       │ Lead responde via WhatsApp
                       ▼
┌─ SENTINELA ──────────────────────────────────────────────────┐
│  Rota A: dra-lia-whatsapp (agente autônomo)                  │
│    → Conversa inteligente, resposta via WaLeads              │
│    → Persiste inbound + outbound em whatsapp_inbox           │
│                                                               │
│  Rota B: wa-inbox-webhook (classificação de campanha)        │
│    → Classifica intent, notifica vendedor (hot lead alert)   │
│    → Persiste em whatsapp_inbox                              │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌─ PROCESSADORES ASYNC ───────────────────────────────────────┐
│  stagnant-processor: avança funil + clean-up sem_interesse   │
│  cognitive-lead-analysis: perfil psicográfico (5+ msgs)      │
│  batch-cognitive-analysis: processamento em lote             │
│  sync-piperun: espelha alterações no CRM                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Endpoints e Payloads

### 5.1 `dra-lia-whatsapp` — Webhook de Conversa

**URL:** `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/dra-lia-whatsapp`
**Método:** POST (sem JWT)
**Debug:** Adicionar `?debug=true` para logar payload sem processar

**Payload flexível aceito (qualquer um destes campos):**

```json
{
  "phone": "5516999887766",       // ou from, sender, contact_phone, chatId
  "message": "Quero saber mais",  // ou text, body, lastMessage, content
  "sender_name": "Dr. João",      // ou name, pushName, contact_name
  "fromMe": false,                // anti-loop
  "isGroup": false                // anti-loop
}
```

**Payload real observado (WaLeads/ChatCenter com @lid):**

```json
{
  "chatId": "553492827648651584155@lid",
  "from": "553492827648651584155@lid",
  "senderPn": "5534928276486",
  "body": "Oi, quero saber sobre impressoras",
  "pushName": "Dr. Maria",
  "fromMe": false,
  "key": {
    "remoteJidAlt": "5534928276486@s.whatsapp.net",
    "fromMe": false
  }
}
```

### 5.2 `smart-ops-wa-inbox-webhook` — Webhook de Campanha

**URL:** `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-wa-inbox-webhook`
**Método:** POST (sem JWT)

```json
{
  "event": "message_received",
  "phone": "5511999887766",
  "message": "Tenho interesse sim, como funciona?",
  "media_url": null,
  "timestamp": "2026-02-26T10:30:00Z"
}
```

### 5.3 `smart-ops-sync-piperun` — Sincronização CRM

**URL:** `https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-sync-piperun`
**Modos:**
- `GET` → auto-redireciona para `?orchestrate=true`
- `?orchestrate=true` → itera 11 pipelines
- `?orchestrate=true&full=true` → full sync (50 páginas por pipeline)
- `?pipeline_id=123` → pipeline específico

---

## 6. Constantes e Configuração

| Constante | Valor | Local |
|-----------|-------|-------|
| `MAX_WHATSAPP_LENGTH` | 4000 chars | dra-lia-whatsapp |
| `DEDUP_OUTBOUND_MS` | 30s | dra-lia-whatsapp |
| `DEDUP_CONTENT_MINUTES` | 5 min | dra-lia-whatsapp |
| `STALE_MESSAGE_MS` | 120s (2 min) | dra-lia-whatsapp |
| `FIVE_DAYS_MS` | 5 dias | stagnant-processor |
| AI decisions/run | max 20 | stagnant-processor |
| History limit | 10 interações | dra-lia-whatsapp |
| Phone match | últimos 9 dígitos | ambos webhooks |

---

## 7. Secrets Necessárias (Supabase Edge Functions)

| Secret | Usado por |
|--------|-----------|
| `SUPABASE_URL` | todos |
| `SUPABASE_SERVICE_ROLE_KEY` | todos |
| `SUPABASE_ANON_KEY` | dra-lia-whatsapp (chama dra-lia) |
| `SELLFLUX_WEBHOOK_CAMPANHAS` | wa-inbox-webhook, stagnant-processor, proactive-outreach |
| `PIPERUN_API_KEY` | sync-piperun, stagnant-processor |
| `DEEPSEEK_API_KEY` | stagnant-processor (decisão estratégica) |
| `LOVABLE_API_KEY` | stagnant-processor (geração de mensagem) |
| `MANYCHAT_API_KEY` | stagnant-processor (fallback) |
| `OPENAI_API_KEY` | dra-lia (LLM principal) |

---

## 8. Pendências

### 8.1 Limpeza de Leads Duplicados

Leads criados antes da correção do `@lid` possuem e-mail `wa_LID_TIMESTAMP@whatsapp.lead` com telefone inválido. Necessário:

```sql
-- Identificar leads com @lid no telefone
SELECT id, nome, email, telefone_raw, telefone_normalized, created_at
FROM lia_attendances
WHERE email LIKE 'wa_%@whatsapp.lead'
  AND (length(telefone_normalized) > 12 OR telefone_raw LIKE '%@lid%')
ORDER BY created_at DESC;

-- Ação: consolidar por telefone real quando possível, descartar órfãos
```

### 8.2 Monitoramento Pós-Deploy

Verificar nos logs do Supabase:

1. `[dra-lia-wa] Resolved @lid` → confirma resolução de LIDs
2. `[dra-lia-wa] Email-loop guard activated` → confirma que o guard está ativo (esperado diminuir com o tempo)
3. `[dra-lia-wa] Pre-seeded agent_sessions` → confirma pre-seed sem erro de FK
4. `[sync-piperun] Pipeline X returned non-JSON` → identificar pipelines com timeout

### 8.3 Evolução do Classificador de Intenção

O classificador v1 é rule-based (regex). Para v2, considerar:

- Substituir por chamada LLM (DeepSeek Chat, ~50 tokens) para mensagens com `confidence < 50`
- Adicionar intent `agendamento` (regex: "agendar", "visita", "demonstração")
- Feedback loop: usar `whatsapp_inbox` com `seller_notified = true` + resultado em `lia_attendances.lead_status` para validar acurácia

---

## 9. Diagrama de Tabelas Envolvidas

```
lia_attendances (CDP)
├── id (uuid, PK)
├── email, nome, telefone_normalized, telefone_raw
├── lead_status, tags_crm, proprietario_lead_crm
├── piperun_id, cognitive_analysis, intelligence_score
├── ...~200 colunas
│
├──< whatsapp_inbox (lead_id FK)
│     ├── phone, phone_normalized, direction
│     ├── message_text, intent_detected, confidence_score
│     └── seller_notified, raw_payload
│
├──< lead_state_events (lead_id FK)
│     ├── old_stage, new_stage, source
│     └── intelligence_score, is_regression
│
└──< message_logs (lead_id FK)
      ├── tipo, mensagem_preview
      └── status, error_details

agent_sessions
├── session_id (unique) = "wa_{phoneDigits}"
├── current_state = "chatting"
├── extracted_entities (JSONB) = { lead_id, lead_name, lead_email }
└── lead_id (FK → leads.id) ← NÃO USADO para WhatsApp (FK incompatível)

agent_interactions
├── session_id = "wa_{phoneDigits}"
├── user_message, agent_response
└── lead_id (FK → leads.id) ← NÃO USADO para WhatsApp
```

---

## 10. Checklist de Deploy

- [x] Tabela `whatsapp_inbox` criada com índices e RLS
- [x] `smart-ops-wa-inbox-webhook` deployado (`verify_jwt = false`)
- [x] `dra-lia-whatsapp` deployado com correções @lid, session_id, history, guard
- [x] `smart-ops-sync-piperun` deployado com safe JSON parsing
- [x] `smart-ops-stagnant-processor` com clean-up `sem_interesse`
- [x] `config.toml` atualizado com todas as funções
- [ ] Limpeza de leads duplicados (@lid)
- [ ] Monitoramento de logs pós-deploy (72h)
- [ ] Validar classificador de intenção com dados reais
