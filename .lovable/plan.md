# Card único por treinamento Online (datas agrupadas)

## Objetivo

Para cursos **Online ao Vivo** e **Online**, mostrar **um único card por treinamento** na Agenda Pública, com todas as datas/horários listados dentro do card — em vez de um card separado para cada turma.

Cursos **Presenciais** continuam como hoje (um card por turma).

## Mudanças

### `src/pages/AgendaPublica.tsx`

1. **Agrupar turmas por curso quando online**
   - Para `modality ∈ {online, online_ao_vivo}`, agrupar `turmas` por `course_id` e renderizar 1 card.
   - Para `presencial`, manter 1 card por turma.

2. **Card online consolidado**
   - Cabeçalho: badge LIVE + título + categoria/instrutor/capa (do curso).
   - Bloco de **Sessões** (substitui o `OnlineDateRow` único): lista enxuta com cada data:
     ```
     📅 29 jun  ·  09:00 – 10:00  ·  1h   [Turma #001]
     📅 06 jul  ·  09:00 – 10:00  ·  1h   [Turma #002]
     ```
   - Próxima sessão destacada com o cronômetro `LiveCountdownInline` no topo (a mais próxima de hoje).
   - Vagas: somar `slots` de todas as turmas futuras (ou mostrar “Vagas por sessão: 20”).
   - Botão **INSCREVA-SE** (já implementado) leva a `/inscricao/{course_slug}` — a página de inscrição já lista as turmas para o usuário escolher.

3. **Ordenação e filtro**
   - Filtrar turmas com `end_date >= hoje` antes de agrupar.
   - Ordenar cards pela menor `start_date` do grupo.

4. **Compartilhamento / ShareButton**
   - Botão de compartilhar passa a apontar para o curso (link `/inscricao/{slug}` ou agenda pública), não para uma turma específica.

### O que NÃO muda

- Schema do banco continua igual (`smartops_course_turmas` por sessão).
- Página `/inscricao/:slug` continua mostrando seletor de turmas (não duplica info).
- Página Presencial inalterada (1 card por turma).
- Fluxo de inscrição, WhatsApp, NPS, lembrete 1h antes — tudo intacto.