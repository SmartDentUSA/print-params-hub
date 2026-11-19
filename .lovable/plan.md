# Por que o card do evento SBRO e o card do formulário mostram números diferentes

## O que já foi conferido no banco

Os dois cards usam regras de contagem diferentes:

| | Card do evento | Card do formulário |
|---|---|---|
| Quem conta como lead | Quem enviou o formulário marcado com o evento SBRO | Quem tem o nome do formulário em qualquer lugar: envio, cadastro do lead ou origem de um negócio no CRM |
| Leads | 19 | 26 |
| Ganhos | 3 (R$ 87.362) | 7 (R$ 0) |
| Venda vale se | o negócio foi fechado depois do **último** envio no evento | o negócio foi ganho depois do **primeiro** contato com o formulário, em qualquer data |

### De onde vem a diferença de leads (26 x 19)
- **6 leads** entraram no formulário em 26/10, três dias depois do evento. Esses envios não estão marcados com o evento. Um deles existe só como origem de um negócio no CRM. Por isso só o formulário conta esses 6.
- **1 pessoa** fez o envio por um cadastro que depois foi unido a outro. O card do formulário passa a contagem para o cadastro principal; o do evento descarta esse envio. Com isso, o evento chega a 20 pessoas e mostra 19.

### De onde vem a diferença de ganhos (7 x 3)
- O formulário conta vendas de pessoas que preencheram o formulário **antes** do evento: uma em 30/03/2026 e outra em 2024.
- O evento só aceita negócios fechados depois do último envio no evento. Dois negócios de R$ 61.000 e um de R$ 25.000 foram fechados no próprio dia 23/10. Pela data salva no CRM, eles parecem anteriores ao horário do envio, por isso ficam de fora ou entram pela metade. Ainda não confirmado.
- **R$ 0 no formulário:** a causa ainda não foi confirmada. Os negócios ganhos têm valor (R$ 1.361, R$ 25.000, R$ 61.000), então o problema provavelmente está no cálculo do valor do formulário ou na forma como a tela o lê. Não consegui rodar esse cálculo daqui por falta de permissão.

## Plano

1. **Confirmar as causas que faltam, só lendo dados**
   - Rodar os cálculos do card do evento e do card do formulário para o SBRO e montar uma lista lead a lead: quem entra, em qual card e por quê.
   - Descobrir por que o valor do formulário aparece R$ 0.
   - Ver se os dois negócios de R$ 61.000 são o mesmo negócio ligado a duas pessoas, o que contaria a venda duas vezes.
   - Ver a data e a hora de fechamento dos negócios do dia 23/10 em relação ao horário do envio.
2. **Corrigir o R$ 0 do formulário.** É um erro: há negócios ganhos com valor.
3. **Nova regra pedida: todo ganho com origem no formulário do evento conta no card do evento**
   - Se o negócio ganho tem como origem o formulário do evento (por exemplo "# [SBRO] Encontro de Estação da SBRO"), ele entra em ganhos e valor convertido do card do evento. Não importa se foi fechado durante o evento ou depois.
   - Também passam a contar no card do evento os leads desse formulário que se cadastraram depois do evento (os 6 do dia 26/10, no SBRO).
   - Uma venda conta uma vez só, mesmo que o negócio esteja ligado a dois cadastros.
   - O card do formulário usa a mesma regra, para que os dois mostrem os mesmos ganhos e o mesmo valor.
   - Nada muda nos negócios: só na forma como são contados.
4. **Testar** com os números reais do SBRO e conferir que os dois cards fecham entre si, com a explicação da diferença.

## Fora do escopo
- Nenhuma mudança em negócios, CRM, Vendas/CS ou na união de cadastros.
- A regra "uma conversão por formulário, com o histórico completo" continua valendo.
- Registrar a nova regra (ganho com origem no formulário do evento sempre conta) na memória do projeto e na lista de tarefas, quando o plano for aprovado.

## Detalhes técnicos
- Evento: `fn_event_lead_stats` usa `lead_activity_log` do tipo `form_submission` com `event_data.event_id`, considera só leads com `merged_into IS NULL` e pega o envio mais recente (`DISTINCT ON ... DESC`). Vendas: `deals.closed_at >= submitted_at`, ou `event_sales` quando houver.
- Formulário: `fn_form_metrics`/`fn_form_revenue` somam envios por `form_name` + `lia_attendances.form_name` + `deals.origin_name`, passam tudo para o cadastro principal e usam o primeiro envio. Vendas: `fn_deal_won_at(closed_at, piperun_updated_at)` maior que o primeiro envio, incluindo pedidos da Loja Integrada.
- A ideia de contar pelo dia do fechamento depende da confirmação no passo 1 e precisa preservar as guardas já documentadas do Painel Comercial e das conversões.
