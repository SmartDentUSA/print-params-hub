## Diagnóstico
O card do catálogo lê specs com esta prioridade (`KbTabCatalogo.tsx` ~L661):
1. `products_catalog.technical_specifications` (match por nome) ← **vence hoje**
2. `system_a_catalog.extra_data.system_a_live.technical_specs` (o que atualizamos)
3. `resins.technical_specs` (match exato)

`products_catalog` tem 11 specs antigas para "Resina 3D Smart Print Bio Vitality" e por isso o card ignora as 16 novas que gravamos.

## Ação
Sobrescrever `products_catalog.technical_specifications` para Bio Vitality com as **mesmas 16 specs oficiais** que já estão no `system_a_catalog`. Sem mudar a ordem de prioridade do componente.

```sql
UPDATE public.products_catalog
SET technical_specifications = $json$[ ...16 linhas... ]$json$::jsonb,
    updated_at = now()
WHERE name ILIKE '%bio vitality%';
```

Validar com `SELECT jsonb_array_length(...)` e pedir refresh da página.

## Fora de escopo
- Não alterar a lógica do `KbTabCatalogo`.
- Não tocar em `resins.technical_specs`.
- Outros produtos.
