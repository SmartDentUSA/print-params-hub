

## Auditoria: Sistema de Inteligencia Comportamental vs Realidade

### Infraestrutura (Schema) - O que EXISTE no banco

| Componente | Existe? | Dados? |
|---|---|---|
| `lead_activity_log` | SIM | **77 registros** (longe dos 500K/ano projetados) |
| `lead_product_history` | SIM | **0 registros** |
| `lead_course_progress` | SIM | **0 registros** |
| `lead_form_submissions` | SIM | **0 registros** |
| `lead_cart_history` | SIM | **0 registros** |
| `lead_sdr_interactions` | SIM | **0 registros** |
| `fn_get_lead_context()` | SIM | Funcional |
| `fn_record_lead_event()` | SIM | Funcional |
| `fn_map_lead_source()` | SIM | Funcional |
| `v_lead_timeline` | SIM | Funcional (UNION ALL das 5 tabelas + activity_log) |

### Alimentacao de Dados - O que ALIMENTA vs o que NAO alimenta

**ALIMENTANDO `lead_activity_log` (77 eventos):**
- Ecommerce webhook: `ecommerce_order_created`, `ecommerce_order_cancelled` (71 eventos)
- Astron postback: `astron_course_progress` (7 eventos, mas NAO popula `lead_course_progress`)
- PipeRun webhook: `crm_deal_won/lost/created/updated`
- Dra. LIA: `lia_lead_identified`, `lia_session_start`, `lia_handoff`
- SellFlux: `sellflux_webhook_entry`
- Ingest lead: `lead_ingested`
- WaLeads: `whatsapp_message_sent`, `sellflux_campaign_sent`
- Tickets: `support_ticket_created`

**TABELAS VAZIAS - Nenhum sistema alimenta:**

| Tabela | Problema |
|---|---|
| `lead_product_history` | Ecommerce webhook NAO insere aqui. So vai para `lead_activity_log` como evento generico |
| `lead_course_progress` | Astron postback NAO insere aqui. So loga na `lead_activity_log` |
| `lead_form_submissions` | Nenhum formulario/webhook popula esta tabela |
| `lead_cart_history` | Nenhum webhook de carrinho abandonado popula esta tabela |
| `lead_sdr_interactions` | Nenhuma interface ou webhook registra interacoes SDR |

### Consequencia Pratica

A funcao `fn_get_lead_context(lead_id)` retorna:
- `cursos_completados`: sempre `[]` (tabela vazia)
- `produtos_comprados`: sempre `[]` (tabela vazia)
- `equipamentos_mencionados`: sempre `[]` (tabela vazia)
- `valor_total_gasto`: sempre `NULL` (tabela vazia)
- `carrinhos_abandonados`: sempre `0` (tabela vazia)
- `num_contatos_sdr`: sempre `0` (tabela vazia)
- `total_interacoes`: retorna dos 77 eventos que existem

A `v_lead_timeline` so mostra dados da `lead_activity_log`. As outras 4 tabelas contribuem com 0 linhas.

### Diagnostico

**A infraestrutura existe 100%. A alimentacao de dados existe ~15%.**

O documento descreve cenarios como "RFM Score", "Carrinhos Abandonados com Contexto", "Reativacao Automatica" — mas nenhum deles funciona na pratica porque as 5 tabelas especializadas estao vazias.

### Plano de Correcao (5 pontos)

1. **Ecommerce webhook (`smart-ops-ecommerce-webhook`)**: Alem de inserir na `lead_activity_log`, precisa fazer upsert na `lead_product_history` com nome/valor/quantidade de cada item do pedido, e popular `lead_cart_history` para pedidos nao-pagos

2. **Astron postback**: Precisa fazer upsert na `lead_course_progress` com curso, progresso e status (alem do log que ja faz)

3. **Formularios (SellFlux/Meta/ingest-lead)**: Precisam inserir na `lead_form_submissions` quando detectam equipamento ou produto mencionado

4. **Loja Integrada polling**: Precisa popular `lead_cart_history` para pedidos com status "abandonado" ou "nao_pago"

5. **Dra. LIA handoff**: Quando transfere para vendedor, precisa inserir na `lead_sdr_interactions` com contexto da conversa

Estimativa: cada ponto e uma edicao de 20-40 linhas no webhook correspondente. Nenhuma migracao necessaria — as tabelas ja estao prontas.

