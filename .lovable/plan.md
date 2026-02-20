
# Correção: Duplicatas no Catálogo após Sincronização Sistema A

## Diagnóstico confirmado

O banco hoje tem **97 pares de produtos duplicados** com o mesmo nome mas dois `external_id` diferentes:

- Registro antigo: `external_id = "53759012"` (ID numérico da Loja Integrada, inserido em nov/2025)
- Registro novo: `external_id = "d6c2d3e9-..."` (UUID do Sistema A, inserido em fev/2026)

O upsert em `sync-knowledge-base` usa `onConflict: 'source,external_id'`. Como os dois IDs são diferentes, o Postgres nunca detecta o conflito e simplesmente **insere um segundo registro**. O problema é que o Sistema A agora envia um UUID próprio no campo `id`, mas o `li_product_id` (ID numérico da Loja Integrada) ainda está disponível no payload — mas não estava sendo usado como `external_id` na primeira rodada histórica.

## Plano de correção em 3 etapas

### Etapa 1 — Limpeza cirúrgica das duplicatas (SQL + migração)

Remover os registros **mais antigos** (os numéricos de nov/2025) para cada nome duplicado, preservando o registro UUID mais recente que tem os dados completos sincronizados do Sistema A.

SQL de limpeza:

```sql
-- Deletar os registros numéricos antigos onde o mesmo nome já existe com UUID novo
DELETE FROM system_a_catalog
WHERE category = 'product'
  AND external_id ~ '^[0-9]+$'  -- apenas IDs numéricos antigos
  AND name IN (
    SELECT name
    FROM system_a_catalog
    WHERE category = 'product'
    GROUP BY name
    HAVING COUNT(*) > 1
  );
```

Isso remove os 97 registros numéricos duplicados, preservando os 97 registros UUID com dados completos de SEO, CTAs e metadados do Sistema A.

### Etapa 2 — Adicionar constraint de unicidade por nome + source (migração)

Adicionar um índice único parcial que previne futuras duplicatas de produtos com o mesmo nome e source, independente do `external_id`:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_system_a_catalog_name_source_product
ON system_a_catalog (source, name)
WHERE category = 'product';
```

Isso garante que mesmo que o `external_id` mude entre sincronizações, o `upsert` nunca criará um segundo registro para o mesmo nome de produto.

### Etapa 3 — Corrigir `sync-knowledge-base` para fallback por nome

No arquivo `supabase/functions/sync-knowledge-base/index.ts`, alterar a lógica de `syncProductsCatalog` para que o upsert use `onConflict: 'source,name'` (em vez de `source,external_id`) quando a `category` é `product`.

Mudança nas linhas 548-550:

```typescript
// ANTES
const { error: upsertError } = await supabase
  .from('system_a_catalog')
  .upsert(catalogItem, { onConflict: 'source,external_id' });

// DEPOIS — produtos conflitam por nome, não por external_id (que pode mudar)
const conflictColumn = productCategory === 'product' ? 'source,name' : 'source,external_id';
const { error: upsertError } = await supabase
  .from('system_a_catalog')
  .upsert(catalogItem, { onConflict: conflictColumn });
```

Isso garante que sincronizações futuras sempre atualizem o registro existente pelo nome, sem criar duplicatas.

## Impacto

| Aspecto | Antes | Depois |
|---|---|---|
| Produtos duplicados | 97 pares (194 registros redundantes) | 0 |
| Unicidade | Apenas por `source+external_id` | Também por `source+name` para produtos |
| Sincronizações futuras | Criam duplicatas | Atualizam o existente |
| Dados preservados | Registros UUID com CTAs e SEO | Todos mantidos |

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Migração SQL | Limpar os 97 duplicatas numéricas + criar índice único `source,name` para `category='product'` |
| `supabase/functions/sync-knowledge-base/index.ts` | Alterar `onConflict` para `source,name` quando `category = 'product'` |

Nenhuma mudança no frontend necessária. Após a correção, o botão "Sincronizar Agora" funcionará sem criar duplicatas.
