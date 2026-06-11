## Problemas identificados

**1. Cards inconsistentes** — `src/pages/AgendaPublica.tsx`:
- Cards sem `start_date` (ex.: "Teste — Turma 1") caem no fallback `t.label` e não mostram nenhuma data.
- Cards com `start_date == end_date` (ex.: Rayshape #145, 1 dia) mostram só uma data, enquanto cards de imersão mostram intervalo. Falta padronizar Início + Fim sempre visíveis.
- Falta linha dedicada para horário (start_time / end_time) — hoje só aparece a data.

**2. Abas do admin** — `src/components/SmartOpsCourses.tsx` (linhas 1278-1298):
- Hoje existe apenas a aba `Página Pública` → renomear para **Página Pública Imersões** (rota `/agenda`).
- Falta a aba **Página Pública Ao Vivo** (rota `/agenda/online`) com os mesmos snippets de embed.

---

## Plano de implementação

### A) Cards uniformes com datas sempre expostas (`PublicTurmaCard`)

Substituir o bloco atual de data por um **mini-bloco fixo Início / Fim**, presente em todos os cards (mesmo se for 1 dia):

```text
┌────────────────────────────────┐
│ 📅 Início            🏁 Fim    │
│ 17/06/2026 09:00     19/06/2026 18:00 │
└────────────────────────────────┘
```

Regras:
- Sempre renderizar as duas colunas (Início e Fim).
- Se `start_date == end_date` → Fim mostra a mesma data com `end_time` (ex.: 18:00).
- Se faltar `start_date` (turma sem agenda) → exibir badge cinza "Data a definir" no lugar do bloco, mas mantendo a mesma altura/estrutura para alinhar o grid.
- Manter horário em `HH:MM` (truncar segundos).
- Manter linha de modalidade/local logo abaixo (sem alteração).

Também alinhar altura mínima do card (`min-h`) para que todos fiquem do mesmo tamanho independentemente do conteúdo (instructor, products, etc.).

### B) Duas abas no admin (`SmartOpsCourses.tsx`)

Refatorar `PaginaPublicaTab` para aceitar prop `variant: "presencial" | "online"` e gerar `publicUrl` dinamicamente:
- `presencial` → `https://parametros.smartdent.com.br/agenda`
- `online`     → `https://parametros.smartdent.com.br/agenda/online`

Atualizar o root `SmartOpsCourses`:

```text
TabsList:
  - Agendamentos
  - Catálogo
  - Inscrições
  - Página Pública Imersões   → PaginaPublicaTab variant="presencial"
  - Página Pública Ao Vivo    → PaginaPublicaTab variant="online"
```

Os mesmos 3 snippets (iframe simples, iframe auto-resize, HTML completo) são gerados a partir do `publicUrl` da variante — sem duplicar código.

Nenhuma alteração de schema, edge function ou rota nova é necessária (a rota `/agenda/online` já existe em `App.tsx`).

---

## Arquivos a editar
- `src/pages/AgendaPublica.tsx` — uniformizar `PublicTurmaCard` com bloco Início/Fim sempre visível e min-height.
- `src/components/SmartOpsCourses.tsx` — renomear aba existente, adicionar a aba "Ao Vivo", parametrizar `PaginaPublicaTab` por variante.
