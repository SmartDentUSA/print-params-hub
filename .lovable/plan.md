## Objetivo
Garantir que `fn_rayshape_owners` (tela Rayshape — Donos Edge Mini) use **somente itens de propostas ganhas** do CRM PipeRun para calcular preço da impressora e total de recompra — nunca `deals.value` bruto nem qualquer dado Omie.

## Diagnóstico atual
`fn_rayshape_owners` hoje:
- `printer_price`: lê o primeiro item "Edge Mini" de `d.proposals` sem checar se a proposta foi a **ganha**. Em deals com várias propostas (rascunhos + aceita), pode pegar uma proposta abandonada.
- `total_post`: soma `d.value` dos deals `status='ganha'` posteriores. Esse `value` pode divergir do total real da proposta aceita (frete, descontos, troca de itens).
- Filtro do dono: `d.proposals::text ILIKE '%Edge Mini%'` — também não exige proposta ganha.

## Mudanças

Recriar `fn_rayshape_owners` com a regra "proposta ganha":

1. **Identificar a proposta ganha de cada deal**
   - Considerar apenas elementos de `d.proposals` cujo `status`/`situation` indique aceita/ganha (campos comuns no payload PipeRun: `status_id`, `situation`, `aceita`, `accepted_at`). Aplicar match case-insensitive em `('aceita','ganha','accepted','won')` e/ou `accepted_at IS NOT NULL`.
   - Se houver mais de uma, usar a mais recente por `updated_at`/`accepted_at`.

2. **CTE `printers` (donos da Edge Mini)**
   - Exigir `d.status = 'ganha'` E que a proposta ganha contenha um item "Edge Mini".
   - `printer_price` = `SUM(item.total)` dos itens "Edge Mini" **dentro da proposta ganha** (não o primeiro item solto).
   - `printer_date` = `d.closed_at` (mantém).

3. **CTE `post` (recompras posteriores)**
   - Para cada dono, somar **itens da proposta ganha** dos deals `status='ganha'` posteriores a `printer_date`, em vez de `d.value`.
   - `total_post` = `SUM(item.total)` de todos os itens da proposta ganha de cada deal posterior.
   - `n_post` = quantidade de deals ganha posteriores com proposta ganha válida.
   - `first_repurchase_days` segue por `closed_at`.

4. **Helper inline (sem nova função)**
   - Resolver tudo com `LATERAL jsonb_array_elements(d.proposals)` + filtro de proposta ganha + `LATERAL jsonb_array_elements(prop->'items')` para somar `(item->>'total')::numeric`.

5. **KPI frontend**
   - `SmartOpsRayshape.tsx` não muda: já consome `total_post` e calcula `Ticket médio recompra = total_post / recompradores`. Com a nova fonte, o ticket reflete itens da proposta ganha.

6. **Sem Omie**
   - Nenhuma leitura de `omie_*`, `faturamento_*`, `lia_attendances.faturamento_total` etc.

## Detalhes técnicos

- Migração: novo arquivo timestamped substituindo `CREATE OR REPLACE FUNCTION public.fn_rayshape_owners()`.
- Manter assinatura `RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public` para não quebrar o RPC chamado em `SmartOpsRayshape.tsx`.
- Manter `WHERE la.merged_into IS NULL` (CDP Integrity).
- Validação pós-deploy: rodar `SELECT fn_rayshape_owners();` e comparar `printer_price` / `total_post` de 3 donos conhecidos com a proposta ganha no PipeRun.

## Fora de escopo
- LeadDetailPanel, KPIs do dashboard, outros componentes.
- Lógica de Omie em qualquer outro lugar.
- Mudanças visuais.
