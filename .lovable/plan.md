## Plano

1. Ajustar os dois botões WA na tela de turma para ficarem claramente icon-only:
   - Criar grupo: ícone de grupo, tooltip "Criar grupo WA".
   - Add membros: ícone de adicionar pessoa, tooltip "Add membros".

2. Melhorar os indicadores de status:
   - Botão "Criar grupo": bolinha verde quando existir grupo vinculado; vermelha quando ainda não existir.
   - Botão "Add membros": bolinha verde quando a última execução adicionar todos sem erros; vermelha quando ainda não foi executado ou houve erro.

3. Preservar o comportamento atual:
   - Não alterar Gerar Doc, Agendar, card da turma ou demais funcionalidades.
   - Manter loading com spinner e chamadas `functions.invoke` existentes.