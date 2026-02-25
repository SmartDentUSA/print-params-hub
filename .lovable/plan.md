

## Plano de Implementacao: Sistema Nervoso Unificado — SellFlux + E-commerce + TAGs

Confirmado: **nao existe** `SELLFLUX_API_TOKEN` nem `SELLFLUX_WEBHOOK_URL` nos secrets. Tambem nao existe `sellflux-field-map.ts` no `_shared/`. Todas as 4 edge functions de messaging (send-waleads, cs-processor, stagnant-processor, proactive-outreach) usam ManyChat ou WaLeads como providers.

---

### Pre-requisito: Secret do SellFlux

Antes de qualquer implementacao, voce precisa fornecer a **URL do webhook** ou o **API Token** do SellFlux. Sem isso, as edge functions nao conseguem enviar mensagens.

---

### Entrega 1: `sellflux-field-map.ts` (arquivo novo compartilhado)

**Arquivo:** `supabase/functions/_shared/sellflux-field-map.ts`

Conteudo:
- `JOURNEY_STAGE_MAP` — mapeia `lead_status` para fase J01-J06
- `LEGACY_TAG_MAP` — converte TAGs organicas do SellFlux (compra-realizada, estagnados-paulo, etc.) para TAGs padronizadas (EC_PAGAMENTO_APROVADO, A_ESTAGNADO_7D, etc.)
- `buildSellFluxPayload(lead, templateId)` — monta body para webhook SellFlux com todos os custom_fields
- `computeTagsFromEvent(eventType, leadData, currentTags)` — calcula TAGs a adicionar/remover baseado no evento
- `mergeTagsCrm(currentTags, toAdd, toRemove)` — merge seguro no array tags_crm
- `replaceVariables(text, lead)` — funcao utilitaria centralizada (remove duplicacao)
- Constantes com todos os prefixos de TAG: EC_, J_, Q_, C_, CS_, LIA_, A_, P_

---

### Entrega 2: Refatorar `smart-ops-send-waleads` para SellFlux

**Arquivo:** `supabase/functions/smart-ops-send-waleads/index.ts`

Mudancas:
1. Importar `buildSellFluxPayload`, `replaceVariables` do shared
2. No inicio, verificar `SELLFLUX_API_TOKEN` (env var)
3. Se presente + `message` parece ser um `template_id` (numerico):
   - Buscar lead completo de `lia_attendances` usando `lead_id`
   - Montar payload com `buildSellFluxPayload(lead, template_id)`
   - POST para `https://api.sellflux.com/...` com Authorization Bearer
   - Nao exigir `team_member_id` (SellFlux e global)
4. Se ausente: manter fluxo WaLeads atual (backward-compatible)
5. Remover `replaceVariables` local (importar do shared)
6. Logging em `message_logs` permanece identico

---

### Entrega 3: Refatorar `smart-ops-piperun-webhook` — TAGs de jornada

**Arquivo:** `supabase/functions/smart-ops-piperun-webhook/index.ts`

Mudancas:
1. Importar `computeTagsFromEvent`, `mergeTagsCrm`, `JOURNEY_STAGE_MAP` do shared
2. Apos calcular `updateData`, adicionar logica de TAGs:
   - Lead criado → `J01_CONSCIENCIA`
   - Etapa muda para contato_feito/em_contato → `J02_CONSIDERACAO` (remove J01)
   - Etapa muda para proposta_enviada/negociacao → `J03_NEGOCIACAO` + `C_PROPOSTA_ENVIADA` (remove J02)
   - Deal won / data_contrato → `J04_COMPRA` + `C_CONTRATO_FECHADO` (remove J03)
   - Deal lost → `C_PERDIDO`
   - Saiu de estagnado para vendas → `C_RECUPERADO` (remove A_ESTAGNADO_*)
3. Fazer merge com `tags_crm[]` existente (fetch current + merge)
4. Substituir envio ManyChat por SellFlux (template `boas_vindas_novo_lead`) quando `SELLFLUX_API_TOKEN` existe
5. Manter ManyChat como fallback

---

### Entrega 4: Refatorar `smart-ops-stagnant-processor` — TAGs + SellFlux

**Arquivo:** `supabase/functions/smart-ops-stagnant-processor/index.ts`

Mudancas:
1. Importar do shared
2. Ao avancar lead no funil:
   - Inserir TAG `A_ESTAGNADO_3D` / `A_ESTAGNADO_7D` / `A_ESTAGNADO_15D` conforme etapa
   - Fazer merge em `tags_crm[]`
3. Substituir ManyChat por SellFlux:
   - Usar `rule.template_manychat` como `template_id` do SellFlux (conforme memoria: mensagem_waleads armazena template_id)
   - POST direto ao SellFlux via `buildSellFluxPayload`
4. Manter ManyChat como fallback

---

### Entrega 5: Refatorar `smart-ops-cs-processor` — SellFlux

**Arquivo:** `supabase/functions/smart-ops-cs-processor/index.ts`

Mudancas:
1. Importar do shared
2. Quando `SELLFLUX_API_TOKEN` existe e `rule.waleads_ativo`:
   - Usar `rule.mensagem_waleads` como `template_id`
   - Buscar lead completo e chamar `buildSellFluxPayload`
   - POST direto ao SellFlux (sem precisar de `waleads_api_key` por vendedor)
   - Inserir TAGs CS (CS_ONBOARDING_INICIO, CS_TREINAMENTO_PENDENTE, CS_NPS_ENVIADO)
3. Remover `replaceVariables` local
4. Manter WaLeads como fallback

---

### Entrega 6: Refatorar `smart-ops-proactive-outreach` — SellFlux templates

**Arquivo:** `supabase/functions/smart-ops-proactive-outreach/index.ts`

Mudancas:
1. Adicionar `sellflux_template_id` em cada `OutreachRule`:
   - `acompanhamento` → template_id configuravel (placeholder)
   - `reengajamento` → template_id configuravel
   - `primeira_duvida` → template_id configuravel
   - `recuperacao` → template_id configuravel
2. Quando `SELLFLUX_API_TOKEN` existe:
   - Ignorar `messageBuilder` (SellFlux nao suporta free-text)
   - Enviar via POST direto ao SellFlux com `template_id` + custom_fields
   - Nao depender de `waleads_api_key` por vendedor
   - Inserir TAGs LIA (LIA_PROATIVO_1, LIA_PROATIVO_2, LIA_PROATIVO_3)
3. Manter WaLeads como fallback (usa messageBuilder + send-waleads)

---

### Entrega 7: Nova Edge Function `smart-ops-ecommerce-webhook`

**Arquivo novo:** `supabase/functions/smart-ops-ecommerce-webhook/index.ts`

Funcionalidade:
1. Recebe webhooks da Loja Integrada (pedido criado, pago, cancelado, boleto gerado)
2. Valida assinatura/secret do webhook
3. Extrai dados do pedido: nome, email, telefone, produtos, valor, status
4. Upsert em `lia_attendances` por email (cria lead se nao existe)
5. Insere TAGs EC_ correspondentes:
   - `order.created` → `EC_INICIOU_CHECKOUT`
   - `order.paid` → `EC_PAGAMENTO_APROVADO` + `J04_COMPRA`
   - `order.cancelled` → `EC_PEDIDO_CANCELADO`
   - Boleto gerado → `EC_GEROU_BOLETO`
6. Insere TAGs de produto: `EC_PROD_RESINA`, `EC_PROD_INSUMO`, etc. (baseado no nome do produto)
7. Dispara SellFlux com template apropriado
8. Logging em `message_logs`

**Config:** Adicionar `[functions.smart-ops-ecommerce-webhook] verify_jwt = false` ao config.toml (webhook externo)

---

### Entrega 8: Parser `sellflux` em `leadParsers.ts`

**Arquivo:** `src/utils/leadParsers.ts`

Adicionar parser para importar CSV exportado do SellFlux (10.724 leads):
1. Mapear colunas: Name → nome, Email → email, Phone → telefone_raw, Tags → tags_crm[]
2. Mapear custom fields: `bought-resin`, `atual-id-pipe`, `proprietario`, etc.
3. Converter TAGs legadas usando `LEGACY_TAG_MAP`:
   - `compra-realizada` → `EC_PAGAMENTO_APROVADO`
   - `estagnados-paulo` → `A_ESTAGNADO_7D`
   - `clinica-consul` → `Q: area_atuacao = CLINICA`
   - `loja-integrada` → source = "loja_integrada"
4. Import em batches (o parser normaliza, a edge function `import-leads-csv` processa em lotes)

Adicionar ao `PARSER_OPTIONS`:
```
{ key: "sellflux", label: "SellFlux Export (CSV)", override: false }
```

---

### Entrega 9: Campos faltantes + badges TAGs no modal de detalhes

**Arquivo:** `src/components/SmartOpsLeadsList.tsx`

Mudancas na interface `LeadFull`:
- Adicionar: `software_cad`, `volume_mensal_pecas`, `principal_aplicacao`, `pais_origem`, `ip_origem`, `proactive_sent_at`, `proactive_count`, 8x `data_ultima_compra_*`

Mudancas no modal de detalhes:
1. Nova secao "Jornada do Cliente" com badge visual colorido baseado nas TAGs J01-J06 em `tags_crm[]`
2. Secao "TAGs" mostrando todas as tags agrupadas por prefixo (EC_, Q_, C_, CS_, LIA_, A_) com cores distintas
3. Campos faltantes distribuidos nas secoes existentes (Equipamentos, Campanha/UTM, Ativos)

---

### Resumo de arquivos

| # | Arquivo | Acao |
|---|---------|------|
| 1 | `supabase/functions/_shared/sellflux-field-map.ts` | **Novo** |
| 2 | `supabase/functions/smart-ops-send-waleads/index.ts` | Refatorar |
| 3 | `supabase/functions/smart-ops-piperun-webhook/index.ts` | Refatorar |
| 4 | `supabase/functions/smart-ops-stagnant-processor/index.ts` | Refatorar |
| 5 | `supabase/functions/smart-ops-cs-processor/index.ts` | Refatorar |
| 6 | `supabase/functions/smart-ops-proactive-outreach/index.ts` | Refatorar |
| 7 | `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | **Novo** |
| 8 | `supabase/config.toml` | Adicionar ecommerce-webhook |
| 9 | `src/utils/leadParsers.ts` | Adicionar parser sellflux |
| 10 | `src/components/SmartOpsLeadsList.tsx` | Campos + badges |

### Bloqueio

O secret `SELLFLUX_API_TOKEN` (ou `SELLFLUX_WEBHOOK_URL`) **precisa ser adicionado** antes de implementar. Forneca o valor para que eu possa configura-lo e prosseguir.

