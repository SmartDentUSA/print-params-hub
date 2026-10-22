# Auditoria dos formulários — 22/10/2026

Somente leitura. Nenhum dado foi alterado.

## 1. Captura das respostas (formulários do sistema, últimos 90 dias)
- 50 envios em 16 formulários ativos. Nenhuma resposta vazia, nenhum envio sem lead.
- Média de respostas por envio menor que o total de perguntas (ex.: 7 de 18) — esperado, perguntas condicionais.
- Telefone sem versão normalizada: 0 casos.

## 2. Timeline
- 48 de 50 envios: todas as respostas aparecem na timeline (uma linha por resposta + evento de envio).
- Exceções concentradas no lead de teste Danilo Henrique (`366ea619-…`): 4 envios antigos (jul–out) com respostas faltando na timeline.
- Lead `545394f8-…` (INDICAÇÃO Erick, 13/10): dois envios no mesmo minuto agrupados; contagem não bate (11 na timeline vs 3+8 salvas) — reenvio do mesmo formulário, sem perda.
- Eventos em leads mesclados (últimos 30 dias, inclui Meta): [IN26] 12, [CIPRO] 16, Orçamento e-commerce 2, RayShape Meta 1, SBRO 2. Esses eventos ficaram no lead antigo e não aparecem no lead canônico.

## 3. CRM e Regra de Ouro
- Envios do sistema: todos com pessoa no PipeRun; deal existente em Vendas reaproveitado (ex.: lead `e1b0d45e` manteve origem `# - KOL - Indicação`).
- **Problema principal:** 24 leads canônicos têm 2 deals ABERTOS no Funil de vendas criados nos últimos 90 dias (48 deals). Padrões:
  - Deal de Meta + deal novo de `# - KOL - Indicação` (ex.: Antonio Carlos Leite Junior, IÊDA, Leonardo Padula, Gabriel Soares, Harley Sandrin, Dr. Rafael) — a regra de indicação deveria fechar o deal do outro vendedor em Estagnados.
  - Deal anterior + deal de evento `[IN26] - Cadastro de leads` (Andrey, Karileny, Leandro, João Pedro).
  - Dois deals da mesma origem em dias próximos (Juan Apolinario — Meta RayShape; Jean Marcos — Orçamento e-commerce; Alexandre — WhatsApp orgânico, mesmo minuto).
- Lead de teste "Tulip Testando" e "Joao Batista Neto" acumulam dezenas de deals abertos antigos (vínculo histórico errado).
- Nome duplicado com grafia diferente: `# - INDICAÇÂO - exocad DentalCad RMS - Erick Souza` (Â) além de `INDICAÇÃO` — risco para atribuição por origem exata.

## 4. Correções propostas (aguardando aprovação)
1. Eventos de timeline de leads mesclados: transferir para o lead canônico (mesma regra da mescla).
2. Deals duplicados em Vendas: investigar por origem (KOL - Indicação, IN26, Meta repetido) qual caminho cria sem passar pela trava; corrigir o caminho, não os deals. Fechar duplicados só com sua confirmação, caso a caso.
3. Unificar a origem com "Â" para a grafia correta.
