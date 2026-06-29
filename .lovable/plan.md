## Objetivo

No admin **Editar Produto** do catálogo, o bloco "📊 Tabela técnica" deve:
1. Já vir preenchido com as 16 specs do **Smart Print Bio Vitality** (e de qualquer outro produto que já tenha specs salvas).
2. Permitir **adicionar / editar / excluir / reordenar** linhas (label + valor).
3. **Salvar de verdade** — refletir imediatamente no card público de `/base-conhecimento?tab=catalogo` sem cron, sem invalidação manual.

## Diagnóstico (curto)

- O editor `TechnicalSpecsEditor` já existe em `AdminCatalogFormSection` e grava em `system_a_catalog.extra_data.system_a_live.technical_specs` + `manually_edited_at`. Add/edit/delete/reorder já funcionam.
- O Bio Vitality já tem as 16 specs em `system_a_catalog` (gravadas no turno anterior).
- **Problema**: o card público lê com prioridade `products_catalog.technical_specifications` (tabela paralela, sincronizada por outro caminho). Quando o admin edita no editor, a mudança fica só no `system_a_catalog` e o card não muda — passa a impressão de "não salvou".

## Plano

### 1. Mirror automático no save (fonte única de verdade = editor)
Em `src/hooks/useCatalogCRUD.ts`, no `updateProduct` (e no `createProduct`), após o `update` do `system_a_catalog`:
- Pegar `extra_data.system_a_live.technical_specs` que veio do formulário.
- Fazer `upsert` em `products_catalog.technical_specifications` localizando a linha por:
  - `slug` (preferencial), senão por `name` normalizado (lower + trim).
- Atualizar também `manually_edited_at` (timestamp) no `system_a_catalog` para proteger contra o sync automático sobrescrever.

Isso garante que **qualquer edição no admin** apareça no card público imediatamente — sem cron, sem reload do Sistema A.

### 2. Pré-carregamento da Bio Vitality
- Nenhuma ação extra: as 16 specs já estão em `system_a_catalog.extra_data.system_a_live.technical_specs` das duas linhas Bio Vitality.
- Ao abrir "Editar Produto" do Bio Vitality, o `TechnicalSpecsEditor` lê `formData.extra_data.system_a_live.technical_specs` → renderiza as 16 linhas editáveis automaticamente.
- Conferir no `useCatalogCRUD.fetchProducts/fetchById` que `extra_data` está incluído no `select`. Se não estiver, adicionar.

### 3. Card sempre vence com edição manual
Em `src/components/knowledge/KbTabCatalogo.tsx`, ajustar a cascata de specs (linha ~660) para:
1. Se `extra_data.system_a_live.manually_edited_at` existir **e** `technical_specs.length > 0` → **usar essas specs** (edição manual tem prioridade absoluta).
2. Senão, `products_catalog.technical_specifications` (docs).
3. Senão, resina (match exato).

Combinado com o mirror do passo 1, a UX fica consistente: o que está no editor é o que aparece no card.

### 4. UI — pequenas melhorias no `TechnicalSpecsEditor`
- Trocar texto auxiliar para deixar claro: *"Edições são salvas no botão **Salvar** do produto. As linhas valem para o card público em PT (EN/ES traduzem na próxima sync)."*
- Manter botões: **Adicionar linha**, **Mover ↑/↓**, **Excluir**, **Buscar do Sistema A** (já existem).

## Arquivos tocados

- `src/hooks/useCatalogCRUD.ts` — mirror para `products_catalog.technical_specifications` no save; garantir `extra_data` no select.
- `src/components/knowledge/KbTabCatalogo.tsx` — prioridade `manually_edited_at` na cascata de specs.
- `src/components/admin/TechnicalSpecsEditor.tsx` — só ajuste de texto auxiliar.

## Fora de escopo

- Tradução automática das specs para EN/ES (fica para a próxima sync; não bloqueia a UI PT).
- Editor de demais campos do produto (nome, CTA, imagens) — já existem no `AdminCatalogFormSection`.
- Mexer em cron / refresh do Sistema A.
