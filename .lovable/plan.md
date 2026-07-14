## Objetivo

1. Remover as 14 resinas duplicadas do catálogo mestre (`system_a_catalog`) — as versões inseridas pelo import `system_a_live` (18/02/2026) — mantendo os registros canônicos com CTAs/documentos já vinculados.
2. Em **Distribuição → Distribuidores**: adicionar barra de **busca + filtros** (país, status ativo/inativo, presença de backlink) e um alternador **Lista / Grade**.

---

## 1. Limpeza dos duplicados (migration de dados)

Estratégia: para cada `name` duplicado dentro de `RESINAS 3D`, marcar `active = false` no registro com `extra_data ? 'system_a_live' = true`. Isso preserva os IDs originais (evitando quebrar `dealer_price_items.catalog_product_id` e outras FKs) e apenas oculta o duplicado das telas (KB, DealerCatalogGrid, DealerPriceTable — todos filtram por `active/approved/visible_in_ui`).

```sql
UPDATE public.system_a_catalog s
SET active = false,
    visible_in_ui = false,
    updated_at = now(),
    extra_data = COALESCE(extra_data, '{}'::jsonb)
                 || jsonb_build_object(
                      'deduped_at', to_jsonb(now()),
                      'deduped_reason', 'system_a_live import duplicate'
                    )
WHERE s.product_category = 'RESINAS 3D'
  AND (s.extra_data ? 'system_a_live')
  AND EXISTS (
    SELECT 1 FROM public.system_a_catalog s2
    WHERE s2.id <> s.id
      AND s2.product_category = 'RESINAS 3D'
      AND lower(trim(s2.name)) = lower(trim(s.name))
      AND s2.active AND s2.approved AND s2.visible_in_ui
      AND s2.created_at < s.created_at
  );
```

Verificação pós-migration: `SELECT lower(trim(name)), COUNT(*) FROM system_a_catalog WHERE active AND approved AND visible_in_ui AND product_category='RESINAS 3D' GROUP BY 1 HAVING COUNT(*)>1` → esperado 0 linhas.

O guard de dedup em `KbTabCatalogo.tsx` (aplicado na rodada anterior) permanece como cinto‑e‑suspensórios.

## 2. Distribuidores — busca + filtros + view lista

Arquivo: `src/components/smartops/SmartOpsDistributors.tsx`

- Adicionar 4 estados: `q` (texto), `country` (`all` | valores distintos), `status` (`all|active|inactive`), `viewMode` (`grid|list`, default `grid`).
- Barra de filtros abaixo do header:
  - `Input` de busca (nome fantasia, razão social, cidade, buyer_name).
  - `Select` País — opções calculadas a partir dos `items` distintos.
  - `Select` Status — Todos / Ativo / Inativo.
  - `Toggle` Grade / Lista (ícones `LayoutGrid` / `List`).
  - Contador `X de Y distribuidores`.
- `filtered` via `useMemo` aplicando os 3 filtros.
- Modo **Lista**: tabela compacta (Logo, Nome, País/UF, Cidade, Status, Backlink, Ações Editar/Kit/Excluir). Reutiliza `Table` do shadcn.
- Modo **Grade**: mantém o layout atual, itera sobre `filtered`.

Sem alterações em `distributors` schema, backend ou permissões.

## Fora de escopo
- Alterar `resins` / `dealer_price_items` / `products_catalog`.
- Reativar/mesclar dados dos duplicados (só marcamos inativos; nada é apagado).
- Novos filtros em Catálogo / Tabela de Preço / Propostas.

## Arquivos
- Migration SQL (dedupe).
- `src/components/smartops/SmartOpsDistributors.tsx` (busca + filtros + view lista).
