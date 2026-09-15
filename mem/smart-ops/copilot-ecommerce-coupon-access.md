---
name: Copilot E-commerce Coupon Access
description: Cupom da Loja Integrada é dado disponível (lojaintegrada_cupom_desconto/_json) e o Copilot consulta via query_ecommerce_orders coupon_only
type: feature
---
Pedidos da Loja Integrada gravam cupom em `lia_attendances`:
- `lojaintegrada_cupom_desconto` (código), `lojaintegrada_cupom_json` (payload completo do cupom), `lojaintegrada_valor_desconto`.
Preenchidos por `smart-ops-ecommerce-webhook` a partir de `order.cupom_desconto`.

Copilot (`smart-ops-copilot`):
- `query_ecommerce_orders` aceita `coupon_only: true` e `coupon_code`; select inclui os campos de cupom/desconto e filtra `merged_into is null`.
- Prompt tem bloco "CUPONS DO E-COMMERCE (dado disponível — nunca dizer que não existe)"; "último cupom utilizado" = primeiro registro com `coupon_only: true`.
- `query_table` liberado para `promotional_coupons` e `promotional_tables` (cupons emitidos por vendedor/tabela promocional).
