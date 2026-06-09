## Objetivo
Substituir a visualização em cards (grid) por uma visualização em lista/tabela na aba **Agendamentos** dentro de Smart Ops > Treinamentos.

## Contexto atual
- A aba `AgendamentosTab` em `SmartOpsCourses.tsx` renderiza um grid de `TurmaCard` (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`)
- Cada `TurmaCard` exibe: status (badge), título da turma, número da turma, modalidade, local/link, datas, vagas, inscritos, ocupação %, instrutor, e ações (GerarDoc, Crachás, WhatsApp grupo, botão Agendar)
- O click no card abre o modal de inscrição (`EnrollmentModal`)

## Mudanças propostas

### 1. SmartOpsCourses.tsx — Aba Agendamentos
- Remover o grid de `TurmaCard` e substituir por uma `<Table>` do shadcn
- As colunas da tabela serão:
  - **Status** — badge com dot colorido (igual ao card)
  - **Turma** — número da turma + título do curso + label da turma
  - **Modalidade / Local** — presencial (cidade) ou online (link)
  - **Data** — start_date → end_date formatadas
  - **Vagas** — `enrolled_count / slots` (ex: 8/12) + barra de ocupação sutil
  - **Instrutor** — nome
  - **Ações** — botões compactos: Agendar, GerarDoc, Crachás, WhatsApp grupo
- Manter o `TreinamentosToolbar` (filtros, busca, sort) intacto
- Manter o `EnrollmentModal` e seu estado (`enrollModal`)
- Manter a ordenação e filtros existentes

### 2. Componente TurmaListRow (novo arquivo)
- Criar `src/components/smartops/TurmaListRow.tsx`
- Recebe as mesmas props de `TurmaCard` (`turma`, `companionCount`, `status`, `onEnroll`)
- Renderiza uma `<TableRow>` com as células descritas acima
- Ações ficam em célula com `flex gap-1`
- Mantém os hooks de WhatsApp (`useTurmaWaGroup`) e botões relacionados

### 3. Estilo
- A tabela usa as classes padrão do shadcn (`Table`, `TableHeader`, `TableBody`, etc.)
- Status com dot colorido (reutilizar `STATUS_DOT` / `STATUS_PILL` do `TurmaCard`)
- Hover na linha para indicar clickabilidade
- Layout responsivo: em telas menores, algumas colunas podem ser ocultadas via `hidden md:table-cell`

## Escopo
- Apenas a aba **Agendamentos** é alterada
- As abas **Catálogo**, **Inscrições** e **Página Pública** permanecem inalteradas
- Nenhuma alteração no banco de dados
- Nenhuma alteração na lógica de filtros/ordenação

## Validação
- Preview da aba Agendamentos mostrando lista em vez de cards
- Filtros (Todos, Inscrições Abertas, Acontecendo, Encerrados) continuam funcionando
- Busca e sort continuam funcionando
- Click na linha abre modal de inscrição
- Botões de ação (Agendar, Doc, Crachás, WA) funcionam normalmente