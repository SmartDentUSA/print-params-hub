

# Fix: Batch DB lookups para evitar CPU Time exceeded

## Problema raiz

O parsing funciona: 13.836 deals, 8.319 pessoas agrupadas. Mas o STEP 3 faz ate 4 queries sequenciais **por pessoa** (email, telefone, pessoa_id, piperun_id). Com 8.319 pessoas = ~33.000 queries individuais → CPU Time exceeded.

## Solucao: Pre-carregar todos os leads em 4 bulk queries

Em vez de consultar lead por lead, carregar todos os leads candidatos de uma vez usando `.in()` com arrays de emails, telefones, pessoa_ids e deal_ids.

### Fluxo novo:

```text
STEP 3a: Coletar todos os emails, phones, pessoa_ids, deal_ids unicos do CSV
STEP 3b: 4 bulk queries com .in() (max ~1000 por batch se necessario)
STEP 3c: Construir lookup maps em memoria (email→lead, phone→lead, etc.)
STEP 3d: Match em memoria — zero queries adicionais
STEP 3e: Batch updates em grupos de 50
```

### Detalhes tecnicos:

1. **Coletar identificadores unicos** do `personMap`:
   - `allEmails[]`, `allPhones[]`, `allPessoaIds[]`, `allDealIds[]`

2. **4 bulk queries** (usando `.in()` com chunks de 500):
   ```typescript
   // Em vez de 33.000 queries:
   const { data: byEmail } = await supabase
     .from("lia_attendances")
     .select("id, email, telefone_normalized, pessoa_piperun_id, piperun_id, piperun_deals_history")
     .in("email", emailChunk);
   ```

3. **Lookup maps em memoria**:
   ```typescript
   const emailMap = new Map<string, Lead>();
   const phoneMap = new Map<string, Lead>();
   const pessoaIdMap = new Map<number, Lead>();
   const dealIdMap = new Map<string, Lead>();
   ```

4. **Match sem DB**: Cascata email → phone → pessoa_id → deal_id, tudo em memoria

5. **Batch updates**: Agrupar updates e executar sequencialmente (sem paralelizar para nao sobrecarregar)

### Resultado esperado:

| Metrica | Antes | Depois |
|---|---|---|
| Queries DB | ~33.000 | ~12 (4 tipos x 3 chunks) |
| CPU time | exceeded | < 10s |
| Updates | 1 por 1 | 1 por 1 (mantido, mas rapido pois match e instantaneo) |

## Arquivo modificado

**`supabase/functions/import-proposals-csv/index.ts`** — reescrever STEP 3 (linhas 391-508) com bulk loading + in-memory matching

