

# Fix: Card do Lead não mostra LTV correto

## Problema Raiz

O frontend em `LeadDetailPanel.tsx` compara status de deals com **case-sensitive** (`=== "ganha"`), mas os deals no JSONB vêm com `"Ganha"` (maiúscula). Resultado: o card mostra LTV = R$0 e 0 ganhos.

Separadamente, há uma diferença de R$ 140 entre PipeRun (R$ 19.438,40) e o DB (R$ 19.298,40) — provavelmente um deal com valor desatualizado.

## Correções

### 1. Fix case-sensitivity no filtro de deals (CRÍTICO)

**Arquivo**: `src/components/smartops/LeadDetailPanel.tsx`

Criar helper para normalizar comparação de status:

```ts
const isWon = (s: string) => ["ganha", "won"].includes((s || "").toLowerCase());
const isLost = (s: string) => ["perdida", "lost"].includes((s || "").toLowerCase());
```

Aplicar em **5 locais**:
- **Linha 293**: `wonDeals` filter → usar `isWon(d.status)`
- **Linha 394**: `lostDeals` filter → usar `isLost(d.status)`
- **Linha 301**: timeline dot color → usar `isWon(d.status)` / `isLost(d.status)`
- **Linha 304**: timeline tag text → mesma normalização
- **Linha 493-507**: `productAggMap` e `sellerAggMap` que usam `wonDeals` (já corrigido automaticamente se wonDeals estiver certo)

### 2. Diferença de R$ 140 — investigar deal do Lucas

O deal mais recente (17/03/2026, Lucas Silva) tem `value: 1026.4` no DB. No PipeRun o "Valor P&S" pode ser R$ 1.166,40 (1026.4 + 140). Possível que o sync capturou o valor sem o frete ou com desconto diferente.

**Ação**: Chamar a API do `smart-ops-leads-api` para verificar o valor retornado, e comparar com o CSV original.

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `src/components/smartops/LeadDetailPanel.tsx` | Adicionar helpers `isWon`/`isLost` e substituir 5 comparações case-sensitive |

## Impacto

Isso afeta **todos os leads**, não só o Paulo Salles. Qualquer lead com deals `status: "Ganha"` (maiúscula) está com LTV = 0 no card.

