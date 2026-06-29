## Diagnóstico

A descrição do card já é lida de `system_a_catalog.description` — mesmo campo que **Editar Produto → Descrição** salva (`src/hooks/useCatalogCRUD.ts:139`).

Em `src/hooks/useCardTranslations.ts`, quando a UI está em **EN/ES**, o card renderiza `description_en` / `description_es` (tradução cacheada). O AdminModal só grava `description` (PT) → a tradução fica desatualizada e o card mostra o texto antigo.

## Plano (escopo mínimo: apenas Descrição)

**Alteração única em `src/hooks/useCatalogCRUD.ts` → `updateProduct`:**

1. **Detectar mudança de descrição:** antes do `.update(...)`, ler `description` atual do produto. Se `updates.description` veio e é diferente do valor salvo:
   - Incluir `description_en: null` e `description_es: null` no payload (invalida tradução stale).
2. **Re-traduzir imediatamente após salvar (pós-save):** se houve mudança, disparar em paralelo, sem bloquear o retorno:
   ```ts
   supabase.functions.invoke('translate-card-row', { body: { table: 'system_a_catalog', id, target: 'en' } });
   supabase.functions.invoke('translate-card-row', { body: { table: 'system_a_catalog', id, target: 'es' } });
   ```
   Esse é o mesmo edge function que `useCardTranslations` já usa — ele grava `description_en`/`description_es` no registro.

Em PT, o card já reflete a nova descrição assim que recarrega. Em EN/ES, passa a refletir após a tradução assíncrona (~1-2s).

## Fora de escopo

- Não alterar `name`, `product_category`, `product_subcategory`, `cta_*_label` (e suas traduções).
- Não alterar resinas, schema, sync do Sistema A, ou o renderer do card.

## Validação

Editar Descrição → salvar → confirmar em PT (imediato) e em EN/ES (após 1-2s) que o card mostra o texto novo.
