---
name: Seller Briefing — gatilho único + lock atômico
description: Briefing de vendedor tem UM gatilho (fn_trigger_seller_briefing) e lock atômico por índice único diário; nunca recriar triggers paralelos
type: constraint
---
Havia 3 triggers em `lia_attendances` chamando `smart-ops-lia-notify-seller`
(`trg_seller_briefing`, `trg_briefing_vendedor_imediato`, `trg_briefing_notify_seller`),
disparando no mesmo segundo → vendedor recebia o briefing repetido (a checagem de lock
de 24h é read-then-write e perde a corrida).

Regras:
- Somente `trg_seller_briefing` / `fn_trigger_seller_briefing` pode disparar o briefing. NUNCA recriar os outros dois.
- `smart-ops-lia-notify-seller` faz claim atômico inserindo linha `pendente` em `message_logs`
  apoiado no índice único parcial `(lead_id, tipo, data_envio_dia) WHERE tipo='briefing_vendedor'`.
  Conflito → `skipped: claim_lock`. `releaseClaim` remove o `pendente` quando o envio não ocorre.
