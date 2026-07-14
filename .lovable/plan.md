## Objetivo
Adicionar coluna **"Última recompra"** logo depois de **Recompras** na tabela do Rayshape Edge Mini (`SmartOpsRayshape.tsx`), exibindo a data do último Deal ganho no CRM após a data da impressora.

## Alterações

### 1. Migration — RPC `public.fn_rayshape_owners`
Recriar (`CREATE OR REPLACE`) mantendo toda a lógica atual e:
- No CTE `post`, adicionar `MAX(d.closed_at) AS last_repurchase_at`.
- No `jsonb_build_object`, incluir:
  ```sql
  'last_repurchase_iso', (po.last_repurchase_at AT TIME ZONE 'America/Sao_Paulo')::date
  ```

### 2. `src/components/SmartOpsRayshape.tsx`
- Interface `Owner`: adicionar `last_repurchase_iso: string | null`.
- `<thead>`: adicionar `<th className="text-right p-3">Última recompra</th>` imediatamente após "Recompras" e antes de "Total recompra".
- `<tbody>`: nova `<td>` com `{fmtDate(o.last_repurchase_iso)}` (`—` quando nulo). Mesma posição.

## Fora de escopo
- Sem mudanças em filtros, categorias, KPIs ou fluxo de manual add.
- A regra "qualquer compra ganha" continua sendo qualquer `deals.status='ganha'` posterior à data da impressora (mesma base do contador Recompras).
