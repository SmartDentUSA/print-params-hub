## Diagnóstico

**Implementação atual dos formulários dinâmicos:**
- `smartops_forms` (29 colunas) + `smartops_form_fields` armazenam definição.
- `SmartOpsFormBuilder` (676 linhas) lista/cria forms; `SmartOpsFormEditor` (441) edita campos com mapeamento p/ colunas do CDP (Contato, Profissional, Empresa, Equipamentos, Interesse, SDR, Marketing).
- `PublicFormPage` renderiza o formulário público em `/f/:slug`, faz submit em `lia_attendances`, dispara workflow SDR e cria deal no PipeRun quando aplicável.
- Tipos de campo suportados: text, email, phone (com DDI), number, textarea, select, radio, checkbox, slider.
- **Tudo funcionando**, exceto: `PublicFormPage.tsx` linha 453 renderiza `fields.map(...)` em uma única lista vertical. **Não existe modo passo-a-passo.**

## O que falta — Modo Wizard (1 pergunta por vez)

### 1. Schema (migration)
Adicionar em `smartops_forms`:
- `display_mode text default 'list' check (display_mode in ('list','step'))`
- `show_progress boolean default true` — barra de progresso no modo step

### 2. Editor (`SmartOpsFormBuilder` ou `SmartOpsFormEditor`)
Adicionar nas configurações gerais do formulário:
- Toggle "Modo de exibição": `Lista única` | `Passo a passo (1 pergunta por vez)`
- Switch "Mostrar barra de progresso" (visível só quando step)

### 3. Renderização pública (`PublicFormPage.tsx`)
Quando `form.display_mode === 'step'`:
- Estado `currentStep` (0..fields.length-1).
- Renderizar **somente** `fields[currentStep]` no mesmo bloco visual (mantém hero/imagem à esquerda).
- Botões: `Voltar` (oculto no passo 0) + `Próximo` (ou `Enviar` no último passo).
- Validação por passo: se `field.required` e vazio → bloqueia avanço com mensagem inline.
- Email/telefone validados antes do `Próximo`.
- Barra de progresso opcional `(currentStep+1)/fields.length` no topo do form.
- Enter avança para próximo passo (não submete antes do fim).
- Animação leve de transição (fade/slide opcional via Tailwind).
- Modo `list` (default) continua exatamente como hoje — zero regressão.

### 4. Validação
- Testar com form existente alternando modos.
- Confirmar submit final igual ao modo lista (mesma payload p/ `lia_attendances`, mesmo workflow SDR/PipeRun).

## Arquivos afetados
- `supabase/migrations/<timestamp>_form_display_mode.sql` (novo)
- `src/components/SmartOpsFormBuilder.tsx` ou `SmartOpsFormEditor.tsx` (toggle de modo)
- `src/pages/PublicFormPage.tsx` (renderização wizard)

## Fora de escopo
- Lógica condicional entre perguntas (skip logic) — pode entrar em iteração futura.
- Salvar progresso parcial (resume) — não solicitado.
