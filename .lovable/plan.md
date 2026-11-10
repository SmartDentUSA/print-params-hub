# Imersões sumidas da Agenda pública

## Causa confirmada
A página /agenda mostra apenas cursos marcados como **públicos**. Hoje existem 20 cursos presenciais ativos marcados como **privados**, entre eles **todas as 9 turmas futuras** (Chairside Print 11/11, 16/11, 17/11, 25/11, 02/12, 09/12, 20/01 e Rayshape A.I Print 07/12, 18/01). Por isso a página exibe "Nenhum treinamento presencial disponível", logado ou não. Os dados das turmas estão corretos.

As cópias de curso (botão clonar e turmas recorrentes) nascem como privadas, e ninguém ligou o "Público" depois.

## O que fazer
1. Tornar públicos os cursos presenciais ativos com turmas futuras (as 9 acima). Os cursos privados já encerrados ficam como estão.
2. No admin de Cursos, mostrar um aviso no card quando um curso está ativo, tem turma futura e está privado ("Não aparece na Agenda").
3. Ao ativar um curso clonado, manter o switch "Público" visível e destacado no formulário, para não esquecer.
4. Conferir /agenda no site após a mudança: as imersões devem aparecer.

## Detalhes técnicos
- Filtro: política de leitura de `smartops_courses` exige `active AND public_visible`; o anônimo recebe 29 de 49 cursos.
- Passo 1: UPDATE em `public_visible=true` só para os IDs com turma `start_date >= hoje` (lista auditada antes).
- Nenhuma mudança em políticas de acesso, Agenda, inscrições ou CRM.
