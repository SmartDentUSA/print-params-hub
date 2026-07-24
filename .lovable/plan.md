## Causa raiz

Ao buscar `alexandreaugustosouza@gmail.com` a ficha carrega o lead (`a84c64bb-…`, Alexandre Augusto Ferreira de Souza) mas o card **Mix de produtos** volta vazio. O lead tem **4 itens reais** em `deal_items` (Base De Teflon Miicraft Plus, NanoClean PoD, Resina Vitality 250g BL1, SmartMake Seal Glaze) vinculados aos deals PipeRun `55649635` e `41803994`, ambos com `status='ganha'` — então os dados existem.

O bug está em `src/components/smartops/ProfessionalMixSummary.tsx` (linhas ~266–280):

```ts
const { data: wonDeals } = await supabase
  .from("deals")
  .select("id, owner_name, closed_at")        // ← deals.id é UUID
  .eq("lead_id", leadId).eq("status", "ganha");
const dealIds = wonDeals.map(d => d.id);       // ← UUIDs
...
.from("deal_items").select(...).in("deal_id", dealIds);  // ← deal_items.deal_id é o piperun_deal_id (inteiro)
```

`deal_items.deal_id` guarda o **`piperun_deal_id`** (ex.: `55649635`), não o UUID de `deals.id`. O `.in(...)` nunca casa, então `crmItems` fica `[]` e o MIX só mostra o fallback de qualificação. Confirmado no banco: `deals` tem colunas `id` (uuid) e `piperun_deal_id` (numérica) separadas.

## Correção

Arquivo único: `src/components/smartops/ProfessionalMixSummary.tsx`.

1. Trocar o `select` de `wonDeals` para trazer `piperun_deal_id` além de `id`, `owner_name`, `closed_at`.
2. Usar `piperun_deal_id` (como string, para casar com o tipo em `deal_items.deal_id`) na lista de IDs e no `Map` de owner/closed_at.
3. Manter o filtro `status = 'ganha'` (todos os deals do Alexandre já estão como ganha; a auditoria também confirma que a ingestão marca ganho corretamente).
4. Fallback: se `piperun_deal_id` vier null em algum deal ganho, ignorar aquele deal (evita casar com `null`).

Depois do fix, a busca do Alexandre passa a mostrar no MIX:
- Base De Teflon — Miicraft Plus (24/03/2026, R$ 200)
- NanoClean PoD (24/03/2026, R$ 399)
- Resina 3D Nano Híbrida Vitality 250g BL1 (22/10/2024, R$ 1.290)
- SmartMake Seal Glaze (22/10/2024, R$ 278)

## Fora de escopo

- Não alterar `CoursesProfessionalProfile.tsx`, `CoursesPage.tsx`, schema de `deals`/`deal_items` nem edge functions — o dado está correto no banco, apenas a leitura no front está errada.
- Fluxo de e-commerce (Loja Integrada) continua igual — o lead não tem pedidos ligados (`attendance_id = 0` orders).
- Sem migração de banco.

## Verificação após a alteração

- Rebuscar o e-mail e conferir que o MIX renderiza as 4 linhas com datas e valores acima.
- Testar um segundo lead com apenas pedidos de e-commerce para garantir que a rota `ecomItems` não regrediu.
