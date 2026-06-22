Ajustar o card consolidado de cursos online/ao vivo na Agenda Pública para:
1. Remover a exibição de vagas no card online.
2. Adicionar um cabeçalho de colunas na lista de sessões.
3. Incluir contagem regressiva individual por sessão.

Mudanças em `src/pages/AgendaPublica.tsx`
- `PublicOnlineCourseCard`:
  - Remover o bloco "Vagas/sessão" do rodapé do card.
  - Substituir a lista atual de sessões por uma estrutura com cabeçalho e linhas:
    - Colunas: **Turma | Dia | Hora de início | Hora do Fim | Duração | Contagem regressiva**
  - Em cada linha de sessão, exibir:
    - Número da turma (ex.: `#002`).
    - Data formatada (ex.: `29 de jun.`).
    - Hora de início (`09:00`).
    - Hora de fim (`10:00`).
    - Duração calculada (`1h`).
    - Contagem regressiva ao vivo até o início, usando o mesmo padrão de status/cronômetro já usado no card (ex.: `12d 04:32:10` ou "Acontecendo agora" / "Realizado").
- `PublicTurmaCard`:
  - Remover o `Metric label="Vagas"` do ramo `isOnline`, caso algum card online ainda passe por ali.

O que NÃO muda
- Cards presenciais continuam mostrando Vagas / Inscritos / Acompanhantes / Restam.
- Formulário de inscrição e roteamento permanecem inalterados.

Critério de aceite
- Na visualização de cursos online/ao vivo, cada card exibe a lista de sessões com cabeçalho das colunas e contagem regressiva por linha, sem mostrar vagas/sessão.