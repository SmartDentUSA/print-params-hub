## Objetivo

Permitir cadastrar no Painel Administrativo → Catálogo um curso **Online ao Vivo** medido em **horas** (não em dias), onde o mesmo treinamento pode ter várias turmas em datas e horários diferentes — exatamente como no exemplo "Software Scan BLZ – da Calibração à exportação de arquivos" com 5 sessões (06/07 09:00–10:00, 20/07 15:30–16:30, 03/08 09:00–10:00, 17/08 15:30–16:30, 31/08 09:00–10:00).

Hoje o `CourseCreateModal` já tem a modalidade `online_ao_vivo`, mas força `duration_days ≥ 1` e cada turma é tratada como bloco de dias. Vamos adicionar um modo "Sessão única em horas" para esse tipo de curso.

## Mudanças

### 1. `CourseCreateModal.tsx` (Painel Administrativo)
- Quando a modalidade for **Online ao Vivo**:
  - Esconder o campo "Duração (dias)" e mostrar **"Duração (horas)"** (campo já existente `durationHoursPerDay` reaproveitado, com label trocado e aceitando frações tipo 1.5).
  - Forçar internamente `duration_days = 1` no save (cada turma = 1 sessão de N horas), sem expor isso na UI.
  - Na seção de Turmas, simplificar o editor: cada turma passa a ter **1 único dia** com `date`, `start_time`, `end_time` (esconder o botão "Adicionar dia" e o campo `day_number` para essa modalidade).
  - Botão "Adicionar sessão" cria uma turma com um único `LocalDay` pré-preenchido.
- Quando a modalidade NÃO for online ao vivo: comportamento atual inalterado (turmas com múltiplos dias).

### 2. Recorrência (já existe, só ajustar copy)
- Para Online ao Vivo, ajustar o label da seção de "Sessões Recorrentes" para deixar claro que cada ocorrência gera **uma turma de 1 sessão**. Lógica de geração permanece igual (`previewRecurrenceDates` já suporta intervalos por dias/semanas/meses/horas/dias-da-semana).

### 3. Renderização (lista/calendário/agenda pública)
- `TurmaCard.tsx`, `TurmaListRow.tsx`, `CoursesCalendarTab.tsx`, `AgendaPublica.tsx`: quando a modalidade do curso for `online_ao_vivo` e a turma tiver 1 único dia, exibir como **"DD/MM/AAAA · HH:MM–HH:MM"** em vez de "X dias". Sem mudança de schema.

### 4. WhatsApp (`courseWhatsapp.ts`)
- `buildCronogramaText` já formata uma linha por dia com horário — funciona naturalmente. Apenas validar que para 1 sessão a saída fica limpa (ex.: "06/07/2026 · 09:00–10:00"). Sem alteração de template.

### 5. Sem mudanças de banco
- `smartops_courses` + `smartops_course_turmas` + `smartops_turma_days` já comportam o modelo (turma com 1 day). Não criamos tabela nem coluna nova.

## Fora de escopo
- Alterar `DEFAULT_ENROLLMENT_TEMPLATE` ou variáveis WhatsApp.
- Mudar enrollments, certificados ou integração Sellflux/PipeRun.
- Bloquear campos de outras modalidades.

## Validação
1. Criar curso "Software Scan BLZ – da Calibração à exportação de arquivos", modalidade Online ao Vivo, duração 1 hora.
2. Adicionar 5 turmas com as datas/horários do exemplo.
3. Conferir lista do catálogo, agenda pública e mensagem de confirmação de inscrição (cronograma + horário corretos).
