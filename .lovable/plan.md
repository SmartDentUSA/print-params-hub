

## Auditoria de Idempotencia e Integridade — Estado Atual

### Dados Atuais (v_behavioral_health)

| Tabela | Registros | Ultimo |
|---|---|---|
| lead_activity_log | 312 | 14/03 20:45 |
| lead_product_history | 132 | 14/03 19:50 |
| lead_cart_history | 78 | 14/03 20:45 |
| lead_course_progress | 2 | 14/03 20:37 |
| lead_form_submissions | 0 | — |
| lead_sdr_interactions | 0 | — |

O backfill funcionou. Agora a questao e blindar contra duplicatas no reprocessamento.

### Analise de Idempotencia por Tabela

**1. `lead_product_history` — RISCO MEDIO**
- Unique index: `(lead_id, product_id)` — BOM
- Codigo usa SELECT + UPDATE/INSERT manual (linhas 802-844), nao `upsert` com `onConflict`
- **Problema**: Se o mesmo pedido for reprocessado (backfill duplicado), o `purchase_count` e `total_purchased_value` sao incrementados novamente. Nao ha checagem de pedido_id para saber se ja foi contabilizado
- **Correcao**: Guardar um array `order_ids_processed` (JSONB) no registro, ou checar `lead_activity_log` por `ecommerce_{eventType}` com o numero do pedido antes de incrementar (a idempotencia do webhook principal ja faz isso via `message_logs`, mas o codigo de product_history esta DEPOIS do guard)

**2. `lead_cart_history` — BOM**
- Unique index: `cart_id` (= numero do pedido)
- Usa `upsert` com `onConflict: "cart_id"` (linha 867)
- Reprocessar o mesmo pedido apenas atualiza o status, nao duplica
- Conversao para "converted" usa `update` com `eq("cart_id")` — idempotente

**3. `lead_course_progress` — BOM**
- Unique index: `(lead_id, course_id)`
- Astron postback usa upsert com `onConflict: "lead_id,course_id"` (confirmado no codigo anterior)
- Reprocessar atualiza progresso, nao duplica

**4. `lead_form_submissions` — SEM IDEMPOTENCIA**
- Sem unique constraint alem do PK (`id`)
- SellFlux e Meta webhooks fazem `INSERT` direto
- Se o mesmo webhook for reenviado, insere registro duplicado
- **Correcao**: Adicionar unique index em `(lead_id, form_type, form_id)` ou `(lead_id, form_type, submitted_at)` e usar `ON CONFLICT DO NOTHING`

**5. `lead_sdr_interactions` — OK (por natureza)**
- Cada interacao SDR e unica por definicao (conversa diferente)
- Sem risco de duplicata no fluxo normal (handoff da LIA e evento unico)

### Plano de Correcao (3 itens)

**1. Blindar `lead_product_history` contra reprocessamento**

O guard de idempotencia do webhook (`message_logs` check) ja impede reprocessamento do mesmo pedido na mesma hora. Mas para backfills manuais (full: true), o risco existe. Solucao: antes de incrementar contadores, checar se o `numeroPedido` ja foi processado para aquele lead+product. Adicionar coluna `last_order_id` (TEXT) ao registro para tracking.

Alternativa mais simples: confiar no guard existente do webhook (que checa `message_logs` por `ecommerce_{eventType}` com numero do pedido). Verificar que o guard esta ANTES do codigo de product_history.

**2. Adicionar unique constraint em `lead_form_submissions`**

```sql
CREATE UNIQUE INDEX idx_lead_form_unique 
ON lead_form_submissions (lead_id, form_type, form_id) 
WHERE form_id IS NOT NULL;
```

E alterar os inserts no sellflux/meta webhooks para usar `ON CONFLICT DO NOTHING`.

**3. Verificar ordenacao do guard de idempotencia no webhook**

Confirmar que o check de `message_logs` (idempotencia) ocorre ANTES de qualquer insert em `lead_product_history` / `lead_cart_history`. Se sim, o reprocessamento esta protegido para o fluxo normal. O backfill full so precisa cuidado ao re-executar.

### Resumo

| Tabela | Idempotente? | Acao |
|---|---|---|
| lead_product_history | Parcial (guard upstream) | Verificar guard order; considerar `last_order_id` |
| lead_cart_history | SIM (onConflict cart_id) | Nenhuma |
| lead_course_progress | SIM (onConflict lead+course) | Nenhuma |
| lead_form_submissions | NAO | Unique index + ON CONFLICT DO NOTHING |
| lead_sdr_interactions | OK (natureza) | Nenhuma |

Risco baixo. A unica mudanca obrigatoria e o unique index em `lead_form_submissions`. O resto e defensivo.

