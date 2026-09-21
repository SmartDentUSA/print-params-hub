---
name: Cupons Loja Integrada — uso ilimitado
description: Cupons de vendedor sempre ilimitados até a validade; LI rejeita quantidade null e trata 0 como esgotado
type: constraint
---
# Cupons promocionais são sempre de uso ilimitado

Regra de negócio: todo cupom gerado para vendedor (desconto e frete grátis)
vale **sem limite de resgates** até a data final (`validade`).

## Como a Loja Integrada se comporta
- `quantidade: null` → **HTTP 400** (rejeitado).
- `quantidade: 0` → cupom **esgotado** (era o que fazia o cupom valer uma vez só).
- `quantidade: 999999` + `quantidade_por_cliente: 0` → ilimitado na prática.

`smart-ops-promo-coupons-sync` envia sempre `UNLIMITED_QTY = 999999` e
`quantidade_por_cliente: 0`. O campo `usage_limit` de `promotional_coupons` e
`coupon_usage_limit`/`coupon_freight_usage_limit` de `promotional_tables` ficam
sempre `null`; a UI só exibe "Uso ilimitado até a data final".

Todo `PUT /cupom/{id}` exige o payload completo (codigo, descricao, tipo, valor);
payload parcial devolve 400.
