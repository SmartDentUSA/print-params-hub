# Redesign: Treinamentos → grid de cards (estilo workspace)

Substituir o layout atual (accordion + tabela densa em Agendamentos / lista em Catálogo) por um **grid de cards 3 colunas** idêntico ao da referência, adaptado aos dados de treinamento.

## Estrutura compartilhada (header)

Acima do grid, em ambas as abas:
- Sub-tabs filtro: `Todos (N) · Próximos · Ao Vivo · Encerrados · Arquivados` (Agendamentos) / `Todos · Ativos · Rascunho · Inativos` (Catálogo)
- Campo de busca "Buscar treinamentos…"
- Dropdown "Ordenação padrão" (data, ocupação, nome)
- Botão principal à direita: `+ Novo Agendamento` / `+ Novo Curso`

## Card — Aba Agendamentos (uma turma por card)

```
┌────────────────────────────────────────┐
│ ● Ao Vivo            ⤴  ⋮             │
│                                        │
│ Imersão Smart Start — Turma Mai/26    │
│ Presencial · 3 dias · São Paulo       │
│                                        │
│ VAGAS    INSCRITOS    OCUPAÇÃO        │
│ 24       18           75,0%   (verde) │
└────────────────────────────────────────┘
```

- **Badge status** (canto sup. esq.): mapeada do `countdown.variant` → `Próximo` (azul), `Inscrições abertas` (verde), `Em andamento` (âmbar), `Encerrado` (cinza).
- **Ações** (canto sup. dir.): ícone compartilhar (copiar link público da turma) + menu `⋮` (Editar, Duplicar, Arquivar, Ver inscritos).
- **Título**: `{course.title} — {turma.label}`.
- **Subtítulo**: `{modality} · {duração} · {local|link}`.
- **Métricas (3 colunas)**:
  - `VAGAS` = `turma.slots`
  - `INSCRITOS` = `turma.enrolled_count` (+ acompanhantes em badge pequeno)
  - `OCUPAÇÃO` = `enrolled_count/slots` em % (verde ≥60%, âmbar 30-59%, vermelho <30%, "Lotado" se 100%).
- **Footer mini** (linha sutil): countdown atual (`Faltam 12 dias`) + instrutor.
- Click no card → abre `EnrollmentModal` (mantém comportamento atual).

## Card — Aba Catálogo (um curso por card)

```
┌────────────────────────────────────────┐
│ ● Ativo              ⤴  ⋮             │
│                                        │
│ Imersão Smart Start                   │
│ Presencial · 3 dias · Recorrente      │
│                                        │
│ TURMAS   INSCRITOS    OCUPAÇÃO MÉDIA  │
│ 6        84           71,2%   (verde) │
└────────────────────────────────────────┘
```

- **Badge status**: `Ativo` (verde) / `Rascunho` (âmbar, `active=false`) / `Privado` (cinza, `public_visible=false`).
- **Métricas**:
  - `TURMAS` = `course.turmas.length` (ativas)
  - `INSCRITOS` = soma de `enrolled_count` de todas as turmas
  - `OCUPAÇÃO MÉDIA` = soma inscritos / soma slots em %
- **Footer mini**: instrutor + `RecurrenceSummary` quando aplicável.
- Click no card → expande edição (mantém `editCourse` atual) ou abre modal lateral.

## Detalhes visuais

- Grid: `grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4`.
- Card: `bg-card border rounded-xl p-5 hover:shadow-md transition cursor-pointer`.
- Métricas: label `text-xs uppercase tracking-wide text-muted-foreground`, valor `text-2xl font-semibold`. Coluna de % em `text-primary` quando ≥60%.
- Badge status: pill compacta com bolinha colorida à esquerda (`● Live` da referência).
- Tudo via tokens semânticos (`bg-card`, `text-foreground`, `text-primary`, `text-muted-foreground`) — sem cores hardcoded.

## Arquivos afetados

- `src/components/SmartOpsCourses.tsx` — substituir `AgendamentosTab` e `CatalogoTab` (linhas 88-322 e 347+) pela nova grid. Manter queries, hooks e modais (`EnrollmentModal`, `CourseCreateModal`) intactos.
- Extrair dois componentes novos para clareza:
  - `src/components/smartops/TurmaCard.tsx`
  - `src/components/smartops/CourseCard.tsx`
- Pequeno header reutilizável `TreinamentosToolbar` (busca + filtros + CTA) inline ou em `src/components/smartops/TreinamentosToolbar.tsx`.

## Fora do escopo

- Não altero schema, queries, lógica de inscrição, recorrência, ou envio de WhatsApp.
- Modais existentes permanecem como estão.
- Aba "Importar Inscritos" (se existir) não é tocada.