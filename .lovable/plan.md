

# Plano: Vincular B2B/B2C com dados reais e historicos (revisado)

## Situacao atual

```text
Modelo operacional: lia_attendances (28.120 leads, empresa denormalizada)
Modelo relacional (sub-utilizado):
  people:     4.070 registros, apenas 1 com primary_company_id
  companies:  1.628 registros, sem vinculo a people
  deals:      8.125 registros, parcialmente vinculados
  buyer_type: 11.408 como 'unknown'
```

## Mudancas

### 1. Migration SQL — Funcao `fn_sync_normalized_from_lead(lead_id uuid)`

Funcao PL/pgSQL SECURITY DEFINER que:
- Upsert em `companies` se `empresa_piperun_id` existir (usando campos `empresa_*` do lead)
- Upsert em `people` se `pessoa_piperun_id` existir, com `primary_company_id` vinculado
- Itera `piperun_deals_history[]` e upsert em `deals` com FK para person e company
- Classifica `buyer_type`: empresa existente → `B2B`, sem empresa → `B2C`

### 2. Migration SQL — Backfill massivo

Executa `fn_sync_normalized_from_lead()` para todos os 28.120 leads existentes, populando people, companies, deals e vinculos.

### 3. Migration SQL — Classificar buyer_type

UPDATE massivo: leads com `empresa_piperun_id` → `B2B`, sem empresa → `B2C`.

### 4. Integrar nos motores de sync

Chamar `fn_sync_normalized_from_lead()` automaticamente apos cada deal processado em:
- `piperun-full-sync/index.ts`
- `smart-ops-sync-piperun/index.ts`
- `smart-ops-piperun-webhook/index.ts`

Isso garante que toda sincronizacao futura alimente automaticamente as tabelas normalizadas.

### 5. Verificar `v_customer_graph`

A view ja existe e cruzara os dados automaticamente apos o backfill.

## Arquivos a criar/modificar

| Arquivo | Acao |
|---|---|
| Migration SQL | Criar `fn_sync_normalized_from_lead()` + backfill + buyer_type |
| `piperun-field-map.ts` | Adicionar helper `callNormalize()` reutilizavel |
| `piperun-full-sync/index.ts` | Chamar normalize apos cada deal |
| `smart-ops-sync-piperun/index.ts` | Chamar normalize apos cada deal |
| `smart-ops-piperun-webhook/index.ts` | Chamar normalize apos cada upsert |

## Ordem de execucao

1. Criar funcao SQL `fn_sync_normalized_from_lead()`
2. Executar backfill massivo
3. Classificar buyer_type
4. Integrar chamada nos 3 motores de sync
5. Verificar v_customer_graph

## Resultado esperado

```text
people.primary_company_id: 1 → ~6.000+
buyer_type classificado: 28.120/28.120
v_customer_graph: dados reais B2B com LTV agregado por empresa
```

