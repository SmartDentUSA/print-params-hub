## Objetivo

Adicionar uma tabela técnica **editável** dentro do editor de produto do Admin Catálogo, permitindo inserir, editar e excluir linhas. Salvamento manual (botão "Atualizar"), sem cron automático.

## Onde

- Tela: **Admin → Catálogo → Editar Produto** (modal renderizado por `src/components/AdminModal.tsx` → seção `src/components/AdminCatalogFormSection.tsx`).
- Fonte de verdade: `system_a_catalog.extra_data.system_a_live.technical_specs` (array `[{label, value}]`). Já é o campo lido pelos cards públicos em `KbTabCatalogo.tsx:664`.

## Mudanças

**1. Novo componente `src/components/admin/TechnicalSpecsEditor.tsx`**
- Props: `value: Array<{label, value}>`, `onChange(next)`.
- Tabela com 2 colunas (Label, Valor) + coluna de ação (lixeira).
- Botão "+ Adicionar linha" → push `{label:"", value:""}`.
- Botão "↑/↓" para reordenar (opcional, simples).
- Input inline em cada célula; alteração local apenas — não persiste sozinho.
- Mostra contador "X specs" e badge "Não salvo" quando dirty.

**2. `AdminCatalogFormSection.tsx`**
- Adicionar nova seção "Tabela técnica" antes de "Status".
- Ler `formData.extra_data?.system_a_live?.technical_specs ?? []`.
- `onChange(next)` chama `handleInputChange('extra_data', { ...formData.extra_data, system_a_live: { ...(formData.extra_data?.system_a_live ?? {}), technical_specs: next, manually_edited_at: new Date().toISOString() } })`.
- Botão "🔄 Buscar do Sistema A" ao lado do título → chama `supabase.functions.invoke('smart-ops-refresh-system-a-cache', { body: { product_id: formData.external_id } })` e atualiza o estado local com o retorno (sobrescreve apenas se usuário confirmar — `window.confirm`).

**3. `useCatalogCRUD.updateCatalogProduct`**
- Garantir que `extra_data` (JSONB) é enviado no update — já é (`...updates` passa direto). Não precisa mexer.

**4. Cron — NÃO criar**
- A função `smart-ops-refresh-system-a-cache` já existe e fica disponível para uso manual (botão acima e por curl). **Não** vou agendar `pg_cron`. Não há alteração de cron neste plano.

**5. Edge function `smart-ops-refresh-system-a-cache`**
- Adicionar guarda: se `extra_data.system_a_live.manually_edited_at` for mais novo que o snapshot vindo do Sistema A, **preserva** `technical_specs` editadas manualmente (não sobrescreve). Mantém os demais campos sincronizados.

## Resultado

- Admin pode entrar em qualquer card de produto, editar/adicionar/remover specs manualmente e clicar "Salvar Produto" (botão existente do modal) para persistir.
- Cards públicos passam a refletir imediatamente (`KbTabCatalogo` já lê desse caminho).
- Sincronização com Sistema A vira opt-in (botão), nunca automática.

## Fora de escopo

- Sem mexer em `resins.technical_specs` (fallback minimalista).
- Sem mexer em `products_catalog` (RLS bloqueado para anon — outro escopo).
- Sem alterar tradução EN/ES (specs são exibidas em PT).
- Sem cron/pg_cron.

## Detalhes técnicos

- Arquivos novos: `src/components/admin/TechnicalSpecsEditor.tsx` (~120 linhas).
- Arquivos editados: `src/components/AdminCatalogFormSection.tsx` (+ ~40 linhas), `supabase/functions/smart-ops-refresh-system-a-cache/index.ts` (+ guarda manual_edit ~15 linhas).
- Sem migração de schema (extra_data já é JSONB).
- Sem novos secrets/connectors.
