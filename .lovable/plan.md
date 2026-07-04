## Diagnóstico

Investigando o composer + edge functions descobri **4 problemas concretos** e a necessidade de **reestruturar o wizard**:

### 1. Textos ruins — a IA recebe NULL de tudo
O `smart-ops-generate-email-ai` consulta colunas que **não existem** em `system_a_catalog`:
```
title, short_description, long_description, benefits, product_url, tags  ← todas NULL
```
Colunas reais: `name, description, image_url, technical_specs, clinical_indications, product_category, cta_1_url, cta_1_description, price` (ignorada), `keywords`.
Resultado: a IA gera texto genérico "produto Smart Dent" sem imagem, sem specs, sem indicação clínica → email vazio.

Também **não busca RAG** de `knowledge_contents`, `success_stories`, `google_reviews`, `resins`, `system_a_content_library` que existem no banco.

### 2. Link WhatsApp quebrado
- Fallback quando o lead não tem vendedor: `wa.me/5511999999999` (número fake). Em envio de **teste** não existe lead → sempre cai no fallback.
- Precisa: usar telefone da conta `team_members` do próprio remetente (o usuário logado) OU o WhatsApp oficial da Smart Dent (`site_settings`).

### 3. Produtos incompletos
Composer limita a `200` mas há **349 ativos** — 149 sumidos. Além disso `.eq("active", true)` cai fora quando `visible_in_ui=false`. Corrigir para `.limit(1000)` e filtrar por `visible_in_ui` OU `active`, ordenados por `display_order, name`.

### 4. Wizard atual mistura tudo na etapa 3
Hoje a Central de Campanhas empilha email + WA + SMS no mesmo passo 3. O usuário quer, **exclusivamente para email**, um wizard próprio de 5 etapas.

---

## Plano

### A) Substituir contexto do produto por bloco RAG rico
Refazer `smart-ops-generate-email-ai` para montar um dossiê antes de chamar a IA:

```text
PRODUTO
  name, description, product_category/subcategory, image_url
  technical_specs (JSON → bullets)
  clinical_indications, contraindications, compatibility_list, certifications
  cta_1_label + cta_1_description (usar como copy oficial)

CONTEÚDO RELACIONADO (top 3 via ILIKE em title/keywords)
  knowledge_contents → { title, slug, excerpt, category }
  system_a_content_library → posts/artigos oficiais
  knowledge_videos → { title, thumbnail_url, video_url }

PROVA SOCIAL (top 2)
  success_stories where produto match
  google_reviews com rating>=4 (rotativo)

VISUAL
  image_url do produto → usada como hero
  og_image_url dos knowledge_contents → cards de conteúdo
```

Prompt reforçado: "Você DEVE usar a imagem do produto (`<img src="...">`), citar 1 indicação clínica concreta, incluir 1 spec técnica real, e incluir 2 cards de conteúdo relacionado com link, imagem e título." Retornar `html_body` sempre com `<img>` do produto no topo e cards com thumbs.

### B) Corrigir link WhatsApp
- No `smart-ops-send-gmail`, buscar `team_members` do **usuário logado** (via `auth.uid()`) e usar `whatsapp_number` como fallback quando o lead não tem vendedor.
- Se ainda não houver, ler `site_settings.value->>'whatsapp_official'` (uma constante Smart Dent).
- Nunca gerar mais `wa.me/5511999999999`.

### C) Consertar lista de produtos
- `.limit(1000)`, `.or("active.eq.true,visible_in_ui.eq.true")`, ordem `display_order.asc, name.asc`.
- Mostrar `name` + `product_category` na lista para desambiguar.
- Adicionar campo de busca (input filter) no composer.

### D) Reestruturar wizard do email em 5 etapas
Novo componente `EmailCampaignWizard` (dentro do `SmartOpsCampaigns` quando `sendChannel === "email"`):

```
┌ Etapa 1 — Produto & Call-to-Action ────────────────────────┐
│ - Segmentação (mostra contagem da audiência)               │
│ - Produto (search + dropdown de 349)                       │
│ - Tom (dropdown já existente)                              │
│ - CTA principal + até 3 secundários                        │
│ - Botão "Gerar Email com IA"                               │
└────────────────────────────────────────────────────────────┘
┌ Etapa 2 — Revisar & Ajustar ───────────────────────────────┐
│ - Assunto, preheader, HTML (com preview)                   │
│ - Botão "Regerar assunto" e "Regerar email"                │
│ - Aviso amarelo se HTML sanitizer detectar problema        │
└────────────────────────────────────────────────────────────┘
┌ Etapa 3 — Testar envio ────────────────────────────────────┐
│ - Input email de teste + botão "Enviar teste"              │
│ - Histórico dos últimos 5 testes (status, timestamp)       │
│ - Checklist visual: ✅ assunto, ✅ CTA, ✅ preview OK       │
└────────────────────────────────────────────────────────────┘
┌ Etapa 4 — Agendar ou enviar ───────────────────────────────┐
│ - Radio: "Enviar agora" | "Agendar para..."                │
│ - Datetime picker (fuso America/Sao_Paulo)                 │
│ - Preview: "X emails para Y leads às HH:mm de DD/MM"       │
│ - Botão "Confirmar disparo"                                │
└────────────────────────────────────────────────────────────┘
┌ Etapa 5 — Criar régua (opcional) ──────────────────────────┐
│ Espelha a régua de grupos de WhatsApp:                     │
│ - Nome da régua                                            │
│ - Lista de N mensagens (add/remove)                        │
│   Cada item: {delay em dias, hora, produto, CTA, tom}      │
│ - Condição de parada: "clicou no CTA" | "abriu email"      │
│                        | "converteu no PipeRun"            │
│ - Salvar em `reactivation_sequences` + steps em            │
│   `reactivation_rules` (tabelas já existentes)             │
└────────────────────────────────────────────────────────────┘
```

Navegação: stepper no topo (`1 → 2 → 3 → 4 → 5`) com voltar/avançar. Etapa 5 fica destacada como opcional ("Transforme este email em régua automática").

### E) Régua (Etapa 5) — arquitetura
Aproveitar as tabelas existentes:
- `reactivation_sequences`: cabeçalho (nome, produto_id, segmento_filter, stop_condition).
- `reactivation_rules`: cada step (order, delay_days, subject_template, html_template, cta_config).
- Novo edge function `smart-ops-sequence-email-tick` (cron a cada hora) que:
  1. Lê sequences ativas.
  2. Para cada lead na audiência, checa qual step é o próximo com base em `campaign_send_log`.
  3. Se `now() >= last_sent + delay_days`, dispara via `smart-ops-send-gmail`.
  4. Respeita `stop_condition` (parou se `campaign_send_log.clicked_at` ou lead virou deal ganho).

---

## Arquivos

- `supabase/functions/smart-ops-generate-email-ai/index.ts` — reescrever contexto (produto real + RAG de conteúdo + prova social + imagens obrigatórias no HTML).
- `supabase/functions/smart-ops-send-gmail/index.ts` — fallback WhatsApp usa `team_members` do usuário + `site_settings`.
- `src/components/smartops/EmailComposer.tsx` — dividir em `EmailCampaignWizard.tsx` (5 steps) + subcomponentes por step; fix `.limit(1000)`, busca, colunas corretas.
- `src/components/smartops/EmailSequenceBuilder.tsx` — **novo**, etapa 5.
- `supabase/functions/smart-ops-sequence-email-tick/index.ts` — **novo**, cron da régua.
- Migration: adicionar `channel='email'` em `reactivation_sequences` se ainda não existir, e `email_step_config` (jsonb) em `reactivation_rules`.

## Fora do escopo
- A/B testing de assunto.
- Editor visual WYSIWYG (mantém preview HTML por enquanto).
- Templates salvos por tom (fica pra depois da régua).
- Analytics de CTR/abertura no wizard (já é registrado; painel dedicado em iteração futura).