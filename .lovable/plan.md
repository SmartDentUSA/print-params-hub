## Objetivo

Refazer os cards de `https://parametros.smartdent.com.br/agenda` para que reflitam exatamente as mesmas informações da aba **Agendamentos** do admin (componente `TurmaCard`), só que numa versão pública (sem botões de ação).

## Mudança de modelo

Hoje a agenda pública mostra **1 card por curso** com lista de turmas embutida. A aba Agendamentos mostra **1 card por turma**. Vou alinhar a página pública ao mesmo modelo: **1 card por turma futura**.

## O que cada card vai mostrar (igual ao TurmaCard do admin)

- Pill de status do countdown (ex.: "Faltam X dias", "Acontecendo agora", "Encerrado").
- Título: `Nome do curso — Label da turma`.
- Subtítulo: modalidade · duração em dias · local (presencial) ou "Link online".
- Linha de data: período da turma (`início – fim` em pt-BR) com ícone de Mapa (presencial) ou Vídeo (online).
- Métricas em 3 colunas: **Vagas**, **Inscritos**, **Ocupação %** (ou "Lotado").
- Rodapé: nome do instrutor à esquerda.

## O que será removido / desabilitado na versão pública

- Sem botão "Agendar" / "Quero participar" / WhatsApp.
- Sem dropdown de ações (ver inscritos, editar etc.).
- Sem botão de compartilhar.
- Sem `onClick` no card (não abre modal de inscrição).

## Filtros aplicados na consulta pública

- `smartops_courses.active = true` e `public_visible = true`.
- `smartops_course_turmas.active = true`.
- Apenas turmas com `end_date >= hoje` (ainda não encerradas).
- Ordenação por `start_date` ascendente (mais próximas primeiro).

## Arquivos afetados

- `src/pages/AgendaPublica.tsx`: trocar `CoursePublicCard` (1 por curso) por loop de turmas e usar um novo `PublicTurmaCard` (read-only, mesma layout do `TurmaCard`).
- (Opcional) extrair um `PublicTurmaCard` separado em `src/components/smartops/PublicTurmaCard.tsx` para não misturar o card admin (com botões) com a versão pública.

## Observação

Para a mudança aparecer em `parametros.smartdent.com.br/agenda`, ainda é preciso clicar **Publish → Update** depois da implementação — o domínio serve o último bundle publicado.