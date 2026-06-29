## Objetivo
Inserir/atualizar a tabela técnica do produto **Resina 3D Smart Print Bio Vitality** no catálogo, usando o editor já existente em `AdminCatalogFormSection` → `TechnicalSpecsEditor`.

## Estratégia
Em vez de digitar 17 linhas manualmente no editor, escrever **uma única migração SQL** que faz UPDATE direto em `system_a_catalog.extra_data.system_a_live.technical_specs` para a linha do produto Bio Vitality, marcando `manually_edited_at = now()` para que o cron `smart-ops-refresh-system-a-cache` **não sobrescreva** as specs no próximo sync (a guarda manual-wins já está implementada).

## Specs a gravar (17 linhas, ordem do briefing)

```
1.  Tipo                          → Resina 3D Nano-Híbrida Odontológica
2.  Carga por Peso                → 58 wt%
3.  Carga por Volume              → ~40–45 vol%
4.  Resistência Flexural          → 147 MPa (ISO 4049, laudo Afinko)
5.  Módulo Flexural               → 5.49 GPa
6.  Dureza Shore D                → >92
7.  Sorção de Água                → 1.5 μg/mm³
8.  Radiopacidade                 → 1.048 mm Al
9.  Carga Inorgânica              → 58–59 wt%
10. Aplicações                    → Coroas definitivas, facetas, inlays/onlays, pontes, protocolos (com/sem barra), estruturas de longa duração (permanentes)
11. Compatibilidade de Camada     → 100 μm e 50 μm
12. Luz UV para Cura              → ~365–405 nm
13. Classificação                 → Resina permanente
14. Certificação                  → Selo FDA 510(k)
15. Carga Inorgânica (Vitality)   → 59.0 wt%
16. Comprovação Clínica           → Única resina da categoria no Brasil com documentação de casos clínicos >5 anos de acompanhamento
```

> Observação: o briefing tinha "Carga Inorgânica" duas vezes (58–59 e 59.0) — mantenho ambas como no original; se quiser consolidar em uma só linha me avise antes de aplicar.

## Passos

1. **Identificar a linha** em `system_a_catalog` para "Bio Vitality" (provavelmente via `slug ilike '%bio-vitality%'` ou `name ilike '%bio vitality%'`) — confirmar antes do UPDATE com um `SELECT` rápido.
2. **Migração SQL** (`supabase--migration`):
   ```sql
   UPDATE public.system_a_catalog
   SET extra_data = jsonb_set(
         jsonb_set(
           COALESCE(extra_data, '{}'::jsonb),
           '{system_a_live,technical_specs}',
           '[ ...17 objetos {label,value}... ]'::jsonb,
           true
         ),
         '{system_a_live,manually_edited_at}',
         to_jsonb(now()::text),
         true
       ),
       updated_at = now()
   WHERE <match Bio Vitality>;
   ```
3. **Validar** com `supabase--read_query` que a linha tem 16 specs e `manually_edited_at` definido.
4. **Frontend**: nenhuma alteração — `KbTabCatalogo` e o card público já leem `extra_data.system_a_live.technical_specs` (fallback público para anon).

## Fora de escopo
- Não mexer em outros produtos.
- Não alterar `resins.technical_specs` (legado).
- Não rodar cron / refresh em massa.

## Pergunta antes de aplicar
Confirma a duplicação de "Carga Inorgânica" (linhas 9 e 15) ou prefere uma só linha com `59.0 wt% (faixa 58–59)`?
