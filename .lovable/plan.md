## Objetivo
Adicionar campo "Texto do Certificado" editável no curso, com variáveis substituíveis, para substituir o texto fixo atual do PDF.

## Variáveis suportadas
- `{{nome}}` — nome do participante
- `{{curso}}` — título do curso
- `{{local}}` — local
- `{{data_inicio}}` — data do primeiro dia (ex.: "27 de maio de 2026")
- `{{data_fim}}` — data do último dia
- `{{periodo}}` — "27 de maio de 2026 a 29 de maio de 2026"
- `{{dias}}` — número de dias
- `{{horas_dia}}` — horas por dia
- `{{carga_horaria}}` — dias × horas/dia
- `{{instrutor}}` — instrutor

## Mudanças

### 1. Banco (migration)
Adicionar coluna em `smartops_courses`:
- `certificate_body_template TEXT` (nullable) — template com `{{variáveis}}`

Default sugerido (aplicado em UI quando vazio, não no banco):
```
concluiu com êxito o treinamento de {{curso}}.
A imersão ocorreu em {{local}}, no período de {{data_inicio}} a {{data_fim}},
com duração de {{horas_dia}}h/dia em {{dias}} dias, e teve como objetivo o
treinamento técnico para operação e utilização das soluções adquiridas.
```

### 2. UI — `src/components/smartops/CourseCreateModal.tsx`
- Novo `Textarea` "Texto do certificado" (5–6 linhas).
- Helper text listando as variáveis disponíveis como chips clicáveis (inserem no cursor).
- Botão "Restaurar texto padrão".
- Pré-visualização ao vivo com valores de exemplo.

### 3. Tipos — `src/types/courses.ts`
Adicionar `certificate_body_template?: string` em `SmartopsCourse`.

### 4. Edge Function — `supabase/functions/generate-certificate/index.ts`
- Carregar `certificate_body_template` do curso.
- Função `renderTemplate(tpl, vars)` que substitui `{{chave}}` (case-insensitive, aceita acentos/espaços normalizados).
- Substituir as duas `drawText` fixas (line1/line2) por renderização do template:
  - Quebrar em parágrafos por `\n`.
  - Word-wrap por largura (`MAX_NAME_WIDTH` ~520) usando `alef.widthOfTextAtSize`.
  - Desenhar centralizado, começando em `LINE1_BASELINE_Y`, com `lineHeight = TEXT_SIZE * 1.4`.
- Incluir o template renderizado no `certificate_render_snapshot` para que mudanças no texto invalidem PDFs antigos (regen automático).
- Fallback: se template vazio/null, mantém as 2 linhas atuais.

## Detalhes técnicos
- Substituição: `tpl.replace(/\{\{\s*([\w_]+)\s*\}\}/gi, (_,k) => vars[k.toLowerCase()] ?? '')`.
- Word-wrap: split por espaço, acumular até exceder largura, emitir linha.
- Sem mudança de layout do PDF além do bloco de corpo (nome permanece intacto).

## Fora de escopo
- Não altera template.pdf do Canva.
- Não muda posição do nome do aluno nem fontes.
