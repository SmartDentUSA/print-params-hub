## Objetivo

Expandir o modal "Nova Automação" (`src/components/SmartOpsCSRules.tsx`) com (1) seção de Horário de Envio, (2) seção genérica de Tipo de Mensagem (já que `tipo`/`media_*` são campos top-level, distintos dos `waleads_*`), e (3) enriquecer o card da regra com horário, ícone do tipo e preview da mensagem fora-do-horário.

## Schema (já existe — sem migração)

`cs_automation_rules` já contém: `horario_inicio time`, `horario_fim time`, `dias_semana int[]`, `enviar_fora_horario bool`, `mensagem_fora_horario text`, `tipo text`, `media_url text`, `media_caption text`, `media_filename text`.

## Mudanças em `SmartOpsCSRules.tsx`

### 1. Constantes e estado

- Adicionar constante `DIAS_SEMANA = [{v:1,l:"Seg"},{v:2,l:"Ter"},...,{v:0,l:"Dom"}]` (ISO: Seg=1 … Sáb=6, Dom=0).
- Adicionar constante `TIPOS_MENSAGEM` reaproveitando `WALEADS_TIPOS` (mesma lista) com ícones: `text→💬, image→🖼️, audio→🎵, video→🎥, document→📄`. Helper `tipoIcon(t)`.
- Estender `interface Rule` com: `horario_inicio: string|null; horario_fim: string|null; dias_semana: number[]|null; enviar_fora_horario: boolean; mensagem_fora_horario: string|null; media_url: string|null; media_caption: string|null; media_filename: string|null;`.
- Estender `defaultForm` com os defaults: `horario_inicio: "08:00", horario_fim: "18:00", dias_semana: [1,2,3,4,5], enviar_fora_horario: false, mensagem_fora_horario: "", media_url: "", media_caption: "", media_filename: ""` e `tipo: "text"` (já existe).
- `openEdit` carrega esses campos do registro (com fallback aos defaults; `horario_inicio` precisa ser convertido `"08:00:00" → "08:00"` via `slice(0,5)`).

### 2. Persistência

- `handleSave` adiciona ao payload os 8 campos novos (vazios viram `null` para textos; `dias_semana` sempre array; horários sempre HH:MM:00 — Postgres aceita HH:MM).

### 3. Bloco "Horário de Envio" no modal

Inserir nova seção entre o cabeçalho e a seção ManyChat (antes do primeiro `<Separator />`):
- Label "🕐 Horário de Envio".
- Linha "Enviar entre" com dois `<Input type="time">` ligados a `horario_inicio` e `horario_fim`.
- Grid de 7 chips clicáveis (Toggle visual via `Badge` ou `Button variant=outline/secondary`) representando dias da semana — clicar adiciona/remove de `dias_semana`. Itens visualmente destacados quando incluídos.
- Switch "Enviar mensagem fora do horário" (`enviar_fora_horario`).
- Quando ON, exibe `<Textarea>` "Mensagem fora do horário" ligada a `mensagem_fora_horario` com placeholder fornecido.
- Adicionar `<Separator />` ao final.

### 4. Bloco "Tipo de Mensagem (geral)" no modal

Adicionar `<Select>` para `form.tipo` com opções de `WALEADS_TIPOS` (label "Tipo geral da mensagem"). Posicionar logo após a seção de Horário (acima de ManyChat) — explicando em help text que esse tipo determina os campos de mídia compartilhados pelos canais.

Quando `form.tipo !== "text"`, renderizar:
- `<Input>` "URL da mídia" → `media_url`.
- `<Input>` "Legenda" → `media_caption`.
- Se `form.tipo === "document"`: `<Input>` "Nome do arquivo" → `media_filename` (placeholder `proposta.pdf`).
- Bloco preview condicional:
  - `image`: `<img src={media_url} className="max-h-32 rounded border" />`
  - `audio`: `<audio controls src={media_url} className="w-full" />`
  - `video`: `<video controls src={media_url} className="max-h-32 rounded border" />`
  - `document`: `<div>📄 {media_filename || "arquivo"}</div>`
- Renderizar preview apenas com `onError` swallow para não quebrar layout em URL inválida.

Não removo nem mexo na seção WaLeads existente — `waleads_tipo`/`waleads_media_*` continuam como campos específicos do canal.

### 5. Card da regra (`renderRuleCard`)

Adicionar uma terceira linha de meta dentro do `CardContent` (acima dos canais):
- Texto "{horario_inicio?.slice(0,5)}–{horario_fim?.slice(0,5)} · {formatDias(dias_semana)}". Helper `formatDias`: se contém `[1..5]` exatos → "Seg–Sex"; se inclui 0 e 6 também → "Todos os dias"; senão lista abreviada `Seg, Qua, Sex`.
- Ícone do tipo geral: `{tipoIcon(r.tipo)} {WALEADS_TIPOS.find(t=>t.value===r.tipo)?.label}`.
- Se `r.enviar_fora_horario && r.mensagem_fora_horario`: nova linha `⏰ Fora do horário: <preview 60 chars>` em texto muted.

Esses campos só aparecem quando preenchidos (graceful para regras antigas onde os campos vêm null).

## Validação

1. Abrir modal "Nova Automação" para um membro: confirmar inputs de horário, chips de dias, toggle e textarea condicional, selector de tipo geral com previews por tipo.
2. Editar regra existente: verificar carregamento dos defaults e formato HH:MM nos time inputs.
3. Salvar e reabrir: confirmar persistência de todos os 8 campos novos via SELECT em `cs_automation_rules`.
4. Card da regra: deve exibir "08:00–18:00 · Seg–Sex" e ícone do tipo. Para regra com `enviar_fora_horario=true` e mensagem preenchida, mostrar o aviso `⏰ Fora do horário: …`.

## Fora de escopo

- Implementar a lógica de fila/dispatch fora-do-horário no backend (somente UI agora).
- Upload de mídia (apenas URL pública por enquanto).
- Migração de dados (todos os campos já existem com defaults adequados).
