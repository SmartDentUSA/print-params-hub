## Problema

Ao desativar um grupo (ex: "Warzone fln") no `SmartOpsWaGroupCampaigns`, o card some momentaneamente mas reaparece como "ativado". Causa: as RLS policies da tabela `wa_groups` só permitem `UPDATE` para `service_role`. Usuários autenticados não têm policy de UPDATE, então o PostgREST retorna **0 linhas afetadas com `error: null`** — falha silenciosa. O `fetchRows()` relê a view `v_wa_group_summary` (ainda com `enabled=true`) e o card volta.

## Correção

### 1. Migration — policy de UPDATE para admins

```sql
CREATE POLICY admin_update_wa_groups
ON public.wa_groups
FOR UPDATE
TO authenticated
USING (public.is_admin((SELECT auth.uid())))
WITH CHECK (public.is_admin((SELECT auth.uid())));
```

### 2. Hardening do handler

Em `src/components/SmartOpsWaGroupCampaigns.tsx`, no `handleToggleEnabled`:
- Adicionar `.select("id")` no update para detectar 0 linhas afetadas
- Se array vazio → tratar como erro de permissão (rollback otimista + toast "Sem permissão para alterar este grupo")

## Fora de escopo

- Não mexer em outras policies de `wa_groups`
- Não alterar a view `v_wa_group_summary` nem fluxos de campanha/blast
