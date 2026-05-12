---
name: Patricia Gastaldi blocked seller
description: Owner 47675 (Patricia Gastaldi) is never a seller — leads always route to Distribuidor de Leads
type: constraint
---
- `team_members.piperun_owner_id = 47675` (Patricia Gastaldi) tem `role = 'lia_comms'`, fora do round-robin de vendas.
- WhatsApp `5516981158403` permanece ativo, mas exclusivamente para comunicação interna da Dra. L.I.A. e reativações orquestradas pelo Copilot.
- `smart-ops-lia-assign` aplica `BLOCKED_SELLER_OWNER_IDS = {47675}` e regex em `BLOCKED_SELLER_NAME_PATTERNS` para Patric[ai] Gastaldi/Silva. Qualquer lead detectado é roteado para `FALLBACK_OWNER_ID` (Distribuidor de Leads), inclusive deals abertos no Funil de Vendas (move pipeline + stage e adiciona nota de auditoria).
- **Why**: Patricia opera no nível de orquestração; cobrar dela como vendedora distorce métricas e bloqueia distribuição.
