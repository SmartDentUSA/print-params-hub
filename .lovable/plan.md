

## Diagnóstico: Por que o lead afonsomsjunior@hotmail.com não tem dados Omie

### Problemas encontrados

**1. A função `omie-lead-enricher` NUNCA executou com sucesso**
- 0 leads sincronizados (`omie_last_sync IS NOT NULL` = 0 de 28.436)
- 0 parcelas em `omie_parcelas`
- 0 registros em `omie_sync_cursors`
- 0 logs da função (nem mesmo um "Backfill Omie iniciado")
- Os cron jobs (`omie-sync-morning`, `omie-sync-evening`) estão configurados mas usam a **anon key** e enviam um body genérico (`{"time": "morning-sync"}`), que cai no `runBackfill()` — uma operação pesada que provavelmente estoura o timeout do `net.http_post`

**2. Bug de coluna: `cnpj` vs `empresa_cnpj`**
- O código usa `.eq("cnpj", cnpjNorm)` em 3 locais (resolveLeadByOmieEvent linha 100, backfill Fase A linha 641)
- A coluna real é `empresa_cnpj` — o query silenciosamente falha (retorna 0 resultados)

**3. Busca por CPF inexistente**
- O lead afonsomsjunior tem `pessoa_cpf: 906.236.573-68` mas NÃO tem `empresa_cnpj`
- A identity resolution busca: `omie_codigo_cliente` → `cnpj` → `email` → `telefone`
- **Nunca busca por `pessoa_cpf`**, então PF (pessoa física) só encontra match por email ou telefone
- Se o cadastro Omie tiver email diferente (ex: outro email), o lead nunca será vinculado

---

### Plano de correção

**Arquivo: `supabase/functions/omie-lead-enricher/index.ts`**

**Correção A — Coluna CNPJ (3 locais)**
- Trocar `.eq("cnpj", ...)` por `.eq("empresa_cnpj", ...)` em:
  - `resolveLeadByOmieEvent` (linha 100)
  - Backfill Fase A (linha 641)
  - `handleWebhook` → `cliente.alterado` (linha 608)

**Correção B — Adicionar busca por CPF na identity resolution**
- Após busca por `empresa_cnpj`, adicionar fallback por `pessoa_cpf`
- Normalizar CPF do Omie (remover pontos/traços) para comparar com `pessoa_cpf` no DB
- Aplicar tanto em `resolveLeadByOmieEvent` quanto no backfill Fase A

**Correção C — Cron jobs com service_role key e batch leve**
- Recriar os cron jobs usando a `service_role` key (migration SQL)
- Adicionar rota `action=sync` que executa apenas Fase A (clientes) em modo incremental (últimas 24h), não o backfill completo
- Manter `runBackfill()` completo apenas para chamadas manuais (sem action ou `action=backfill`)

**Correção D — Timeout e paginação segura**
- Adicionar timeout guard: se a execução ultrapassar 50s, parar e retornar parcial
- Salvar cursor de paginação em `omie_sync_cursors` para retomar no próximo cron

---

### Detalhes técnicos

Arquivos modificados:
- `supabase/functions/omie-lead-enricher/index.ts` (correções A, B, C, D)
- 1 migration SQL (recriar cron jobs com service_role key + rota `action=sync`)

Impacto esperado:
- O lead afonsomsjunior será encontrado via email OU CPF na Fase A
- Todos os leads PF (pessoa física) passam a ser vinculáveis pelo CPF
- Cron executará diariamente sem timeout, preenchendo `omie_faturamento_total`, `omie_score`, parcelas, etc.

