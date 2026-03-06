

# FIX #1 — Remover ANON_KEY do dra-lia-whatsapp

## Diagnostico

O arquivo `supabase/functions/dra-lia-whatsapp/index.ts` tem 3 ocorrencias de `ANON_KEY`:

1. **Linha 142** — Declaracao: `const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;`
2. **Linha 387** — Header Authorization na chamada ao `dra-lia`: `Bearer ${ANON_KEY}`
3. **Linha 482** — Header Authorization na chamada ao `smart-ops-send-waleads`: `Bearer ${ANON_KEY}`

A variavel `SERVICE_ROLE_KEY` ja esta declarada na linha 141.

## Mudancas

| # | Linha | Acao |
|---|-------|------|
| 1 | 142 | Deletar a linha `const ANON_KEY = ...` inteira |
| 2 | 387 | Substituir `ANON_KEY` por `SERVICE_ROLE_KEY` |
| 3 | 482 | Substituir `ANON_KEY` por `SERVICE_ROLE_KEY` |

**Total: 3 linhas alteradas (1 removida, 2 modificadas)**

Apos a alteracao, `ANON_KEY` nao aparecera mais em nenhum lugar do arquivo. Nenhum outro trecho sera tocado — comportamento identico, apenas autenticacao mais segura via SERVICE_ROLE_KEY.

Deploy automatico da edge function apos salvar.

