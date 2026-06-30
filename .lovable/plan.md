## Objetivo

Que TODO o conteúdo dos cards do Catálogo (incluindo a Tabela Técnica) apareça traduzido em PT/EN/ES conforme a língua da UI.

## Estado atual

- **Labels** de specs já são traduzidos via dicionário `SPEC_LABELS` em `KbTabCatalogo.tsx`.
- **Valores** das specs (ex.: "Placas miorrelaxantes…", "Certificação ANVISA: 81835960001", "DA1: 7898… | DA2: 7898…") são gravados em `system_a_catalog.extra_data.system_a_live.technical_specs` em PT e nunca traduzidos → aparecem em português mesmo em `/en` e `/es`.
- Colunas `technical_specs_en/_es` (top-level) já existem em `system_a_catalog`, `products_catalog`, `resins`, mas:
  - O card lê do path `extra_data.system_a_live.technical_specs` (live) e ignora a versão top-level traduzida (exceto para `resins`).
  - O `translate-card-row` espera array em `technical_specs` top-level, mas a fonte real está dentro de `extra_data` (e a coluna top-level pode estar em outro shape) → tradução nunca é disparada para os dados manualmente inseridos.
- `products_catalog.technical_specifications_{en,es}` existem mas não são lidos pelo card.

## Correções (todas cirúrgicas)

### 1. `supabase/functions/translate-card-row/index.ts`
- Para `system_a_catalog.technical_specs`: ao montar o payload, se a coluna top-level estiver vazia/não-array, ler do path `extra_data.system_a_live.technical_specs` como fonte PT. A gravação continua em `technical_specs_{lang}` (coluna top-level).
- Manter o restante do contrato (resins/products_catalog já estão corretos).

### 2. `src/components/knowledge/KbTabCatalogo.tsx` — query
- Incluir no `SELECT` de `system_a_catalog`: `technical_specs_en, technical_specs_es, translated_at_en, translated_at_es`.
- Incluir no `SELECT` de `products_catalog`: `technical_specifications_en, technical_specifications_es` e propagar no `DocLinks`.

### 3. `KbTabCatalogo.tsx` — leitura de specs (bloco `rawSpecs`, linhas 663-688)
Quando `specLang === 'en'|'es'`, preferir a versão traduzida antes da PT:
- system_a_live (manuallyEdited): se `(p as any).technical_specs_{lang}` existir e não-vazio, usá-lo; senão usa o PT live e dispara tradução.
- products_catalog: se `d?.technical_specifications_{lang}` existir, usá-lo; senão PT.
- resin: já implementado.

### 4. `KbTabCatalogo.tsx` — disparo de tradução on-demand
- Adicionar `'technical_specs'` à lista de campos de `useCardTranslations('system_a_catalog', …)`. Isso fará o hook chamar `translate-card-row` para qualquer card em EN/ES sem tradução salva. Como `translate-card-row` agora lê do `extra_data` quando necessário (passo 1), todos os specs manualmente inseridos serão traduzidos e persistidos em `technical_specs_{lang}`.
- Adicionar uma segunda chamada `useCardTranslations('products_catalog', …, ['technical_specifications'])` para os cards que usam a tabela `products_catalog` como fonte (chave: `p.id` do products_catalog; necessário expor esse id no `DocLinks`).

### 5. Chips de apresentação (`presDeduped`)
- A string fixa `imp/frasco` (linha 656) e `formatPresChip` ficam em PT. Pequena correção: trocar por chave i18n `t('kb.catalogo.imp_per_bottle')` com fallback PT/EN/ES.

### 6. Sem migração de schema
- Todas as colunas `_en/_es` necessárias já existem; só preenchimento on-demand. Sem `ALTER TABLE`.

## Validação
- `/en/knowledge-base?tab=catalogo` → abrir "Bio Vitality" → modal "Tabela técnica" em inglês (label + value). Primeiro acesso pode mostrar PT enquanto traduz; segundo acesso já em EN.
- `/es/...` mesmo comportamento.
- PT inalterado.
- Demais campos do card (nome, descrição, CTAs) já funcionam — só specs entra agora.

## Não tocar
- Lógica de filtro/`normCat`, taxonomia, RLS, dados do banco.
