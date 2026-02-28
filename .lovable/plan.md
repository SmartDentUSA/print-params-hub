

## Plano Final: Form Builder no Smart Ops

Decisao: remover a flag `lia_enabled`. Todos os formularios seguem o mesmo fluxo — a LIA analisa tudo que entra via `cognitive-lead-analysis` como ja faz hoje. Menos complexidade, menos decisao para o usuario.

### Resumo do que sera implementado

1. **Migration SQL** — 2 tabelas: `smartops_forms` e `smartops_form_fields`
   - `smartops_forms`: name, slug, description, active, form_purpose (NPS/SDR/ROI/CS/Captacao/Evento), theme_color, success_message
   - `smartops_form_fields`: form_id, label, field_type, db_column (nullable), custom_field_name (nullable), options (JSONB), required, placeholder, order_index, roi_config (JSONB)
   - RLS: admin ALL, anon SELECT em ativos

2. **`SmartOpsFormBuilder.tsx`** — Aba "Formularios"
   - Lista: Nome (editavel) | Finalidade (badge colorido) | Campos | Submissoes | Ativo | Acoes
   - Acoes: Editar, Copiar Embed, Copiar Link, Toggle ativo
   - Botao "Novo Formulario"

3. **`SmartOpsFormEditor.tsx`** — Editor de campos
   - Select coluna mapeada (agrupado por categoria) ou "Campo customizado" (input livre)
   - Select tipo (text/number/radio/select/checkbox/roi_calculator)
   - Label, placeholder, obrigatorio
   - Editor de opcoes para radio/select/checkbox
   - Config ROI para roi_calculator
   - Setas para reordenar

4. **`PublicFormPage.tsx`** + rota `/f/:slug`
   - Renderiza formulario por slug
   - Captura UTMs da URL automaticamente
   - Campos customizados vao para `raw_payload.custom_fields`
   - Submit → POST `smart-ops-ingest-lead` com form_name + form_purpose + UTMs
   - Mensagem de sucesso configuravel

5. **Editar `SmartOpsTab.tsx`** — adicionar aba "Formularios"

6. **Editar `App.tsx`** — adicionar rota `/f/:slug`

### Arquivos

| # | Arquivo | Acao |
|---|---------|------|
| 1 | Migration SQL | NOVO |
| 2 | `src/components/SmartOpsFormBuilder.tsx` | NOVO |
| 3 | `src/components/SmartOpsFormEditor.tsx` | NOVO |
| 4 | `src/pages/PublicFormPage.tsx` | NOVO |
| 5 | `src/components/SmartOpsTab.tsx` | EDITAR |
| 6 | `src/App.tsx` | EDITAR |

