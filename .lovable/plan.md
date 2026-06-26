## Problema

O formulário NPS (após o agendamento de treinamento online) mostra o campo "Seu e-mail" mesmo o usuário já tendo informado e-mail e telefone na etapa de identificação. Redundância sem motivo.

## Mudança

Em `src/pages/PublicCourseEnrollment.tsx` (componente `NpsForm`):

- Remover o bloco do input "Seu e-mail" (linhas 415–418).
- Manter o `defaultEmail` recebido por prop e enviá-lo direto no `supabase.functions.invoke("smartops-public-nps", { body: { email: defaultEmail, ... } })` — sem `useState` para email.
- Sem alteração no backend (`smartops-public-nps` continua recebendo `email` no payload).

Nada mais muda: as 3 perguntas de estrelas, o comentário opcional e o botão "Enviar avaliação" permanecem iguais.