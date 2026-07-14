# Plano: Novas Regras de Normalização de Nome de Produto

Adicionar duas regras em `PRODUCT_NAME_RULES` (arquivo `src/components/SmartOpsRayshape.tsx`) para que o card **Produto principal / 2º / 3º na 1ª compra** mostre o nome oficial e agrupe variações.

## Regras a adicionar

```ts
{ pattern: /glaze\s*on/i,                       label: "GlazeON - Splint" },
{ pattern: /(nano\s*h[ií]brida\s*vitality|vitality)/i, label: "Resina 3D Smart Print Bio Vitality" },
```

Efeito:
- `Glaze ON - SPLINT (APLICAÇÃO...)` → **GlazeON - Splint**
- `Resina 3D Nano Híbrida Vitality`, `Vitality 1kg`, etc. → **Resina 3D Smart Print Bio Vitality**
- Variações somam no mesmo bucket (contagem de leads/unidades no card).
- Labels ficam consistentes com a seção "Unidades vendidas — pós-compra da impressora".

## Fora do escopo

- Não mexer em RPCs ou dados no banco.
- Não tocar em outros KPIs.
