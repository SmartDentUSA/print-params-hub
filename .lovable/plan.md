
Objetivo: corrigir o fluxo de suporte da Dra. LIA para que ela não “volte a se apresentar” quando o lead pede atendimento humano e para que reconheça melhor problemas como “problema no meu exocad”.

1. Corrigir o bug de reentrada do suporte
- Arquivo: `supabase/functions/dra-lia/index.ts`
- Hoje, se `support_ticket_completed` estiver `true`, a função limpa a flag, mas continua usando o valor antigo na mesma execução.
- Resultado: a primeira mensagem de novo pedido de suporte é ignorada e cai no fluxo normal da IA.
- Ajuste planejado:
  - trocar a lógica por uma variável efetiva de runtime, algo como “ticketJustCompletedEffective”
  - ao detectar uma nova solicitação real de suporte, limpar a flag e seguir imediatamente para o bloco `support_flow→start` na mesma requisição

2. Fortalecer a detecção de intenção de suporte
- Arquivo: `supabase/functions/_shared/lia-guards.ts`
- Expandir `SUPPORT_KEYWORDS` para cobrir melhor:
  - softwares CAD: `exocad`, `3shape`, `cad`, `software`
  - frases como: “problema no meu exocad”, “não abre”, “não inicia”, “não carrega”, “travou”, “deu erro”
  - pedidos de humano mais diretos: “atendente humano”, “falar com alguém”, “suporte humano”, “quero falar com uma pessoa”
- Isso evita que mensagens claramente de suporte caiam no fluxo genérico.

3. Preservar contexto logo após pedido de humano
- Arquivo: `supabase/functions/dra-lia/index.ts`
- Melhorar a continuidade quando o lead faz:
  - pedido de humano/suporte
  - e na mensagem seguinte descreve o sintoma
- Ajuste planejado:
  - quando o suporte for acionado, garantir que a sessão entre de fato em `support_flow_stage: "select_equipment"`
  - aceitar respostas curtas seguintes como continuação do suporte, em vez de permitir que a IA responda com nova saudação

4. Ajustar prioridade dos interceptores
- Arquivo: `supabase/functions/dra-lia/index.ts`
- Revisar a ordem para garantir que:
  - suporte/humano tenha prioridade sobre a resposta conversacional normal
  - uma mensagem de suporte não seja “engolida” pelo fluxo genérico do lead identificado

Resultado esperado
- No seu exemplo, após “Preciso falar com um atendente humano, por favor.” a LIA deve iniciar o fluxo de suporte/ticket imediatamente.
- Após “Estou com problema no meu exocad”, ela deve tratar como suporte técnico, não como conversa comercial/genérica.
- Após “eles não está ligando”, ela deve continuar coletando diagnóstico, sem reiniciar com “como posso te ajudar hoje”.

Arquivos envolvidos
- `supabase/functions/dra-lia/index.ts`
- `supabase/functions/_shared/lia-guards.ts`

Detalhes técnicos
- Não precisa mudar banco nem RLS.
- A correção é toda em lógica de sessão/interceptores.
- Vou manter o fluxo atual de ticket técnico, apenas corrigindo:
  - reentrada após `support_ticket_completed`
  - cobertura dos padrões de suporte
  - continuidade de contexto entre mensagens curtas de diagnóstico
