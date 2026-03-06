

# FIX #3 — Secondary Intent Patterns no wa-inbox-webhook

## Diagnostico

**Arquivo:** `supabase/functions/smart-ops-wa-inbox-webhook/index.ts`
**Função:** `classifyMessage(text: string)` — linhas 61-75
**Variável de texto:** `text` (parâmetro da função) + `normalized` (versão sem acentos, linha 64)
**Ponto de inserção:** Linha 73, imediatamente antes de `return { intent: "indefinido", confidence: 20 };` (linha 74)

## Mudança

Inserir o bloco de 14 secondary patterns entre a linha 72 (fechamento do `for`) e a linha 74 (return indefinido). Os patterns usarão `text` (original) e `normalized` (já disponível) para matching — melhor que `text.toLowerCase()` porque `normalized` já remove acentos.

Adaptação: trocar `rule.pattern.test(text.toLowerCase())` por `rule.pattern.test(normalized)` para aproveitar a variável que já existe e capturar variações com/sem acento.

**Total:** ~30 linhas inseridas, 0 linhas alteradas/removidas. Nenhuma outra parte do arquivo tocada.

