# Imersões sumidas da Agenda + liberação para vendedores

## Causa confirmada
A página /agenda mostra apenas cursos marcados como **públicos**. Hoje há 20 cursos presenciais ativos marcados como **privados**, entre eles **todas as 9 turmas futuras** (Chairside Print 11/11, 16/11, 17/11, 25/11, 02/12, 09/12, 20/01 e Rayshape A.I Print 07/12, 18/01). Por isso aparece "Nenhum treinamento presencial disponível", com ou sem login. As turmas estão corretas; as cópias de curso nascem privadas e ninguém ligou o "Público".

## O que fazer
1. Tornar públicos os cursos presenciais ativos com turmas futuras (as 9 acima). Cursos privados já encerrados ficam como estão.
2. No admin de Cursos, avisar no card quando o curso está ativo, tem turma futura e está privado ("Não aparece na Agenda").
3. Destacar o switch "Público" ao editar um curso clonado.
4. **Vendedor logado pelo celular**: liberar todas as funções de equipe da Agenda (envio de fotos/vídeos, depoimentos, eventos e treinamentos passados). Hoje a página reconhece o vendedor pelos últimos 8 dígitos do celular; vou também aceitar o vínculo de vendedor que o login por celular já grava, para não falhar quando o número estiver em outro formato.
5. Conferir /agenda no site: imersões visíveis para todos e funções de equipe liberadas para o vendedor.

## Detalhes técnicos
- Leitura de `smartops_courses` exige `active AND public_visible`; o visitante recebe 29 de 49 cursos.
- Passo 1: UPDATE `public_visible=true` só para IDs com turma `start_date >= hoje`.
- Passo 4: `fn_is_team_member` passa a aceitar `user_metadata.team_member_id` de membro ativo, além de telefone/e-mail. Testar com vendedor real logado por celular.
- Nenhuma mudança em políticas de acesso, inscrições ou CRM.
