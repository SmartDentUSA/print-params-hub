# SBRO: card do evento e card do formulário com o mesmo resultado de vendas

## Por que os valores são diferentes (conferido negócio a negócio)

| Negócio ganho | Origem no CRM | Valor | Card do evento | Card do formulário |
|---|---|---|---|---|
| Carolina Del Greco | SBRO | R$ 61.000 | conta | conta |
| Emilio Carlos Zanatta | SBRO | R$ 25.000 | conta | conta |
| Cristiana Monteiro de Castro | SBRO | R$ 1.361,71 | conta | conta |
| Raquel Virgínia Zanetti | SBRO | R$ 61.000 | **não conta**: fechado às 16h45, e o cadastro no evento foi às 18h57 | conta |
| Danilo Viegas da Costa | SBRO | R$ 25.000 | **não conta**: fechado às 18h11, e o cadastro no evento foi às 20h26 | conta |
| Plataforma Tec (2024) | outra | R$ 1.576,45 | não conta | **conta indevidamente** |
| Melina Copatto (2024) | outra | R$ 763,10 | não conta | **conta indevidamente** |

- Card do evento: R$ 87.362 (3 vendas). Ele perde duas vendas do próprio SBRO porque o negócio foi fechado antes do horário do cadastro no evento.
- Card do formulário: R$ 175.701 (7 vendas). Ele soma duas vendas antigas, de 2024, que não têm origem no SBRO. Entram só porque a pessoa já tinha preenchido o formulário antes.
- **Pela sua regra, o certo para os dois cards é R$ 173.361,71 em 5 vendas.**

## O que muda

1. **Card do evento:** passa a contar todo negócio ganho cuja origem no CRM é um formulário do evento, durante ou depois do evento, sem comparar com o horário do cadastro. As vendas importadas de planilha do evento continuam valendo quando existirem.
2. **Card do formulário:** em formulários de evento, a conversão passa a seguir a mesma regra: negócio ganho com origem no formulário. As vendas antigas com outra origem saem da conta.
3. **Leads:** o card do evento passa a incluir também quem se cadastrou pelo formulário do evento depois da data. No SBRO são 6 pessoas no dia 26/10, e o número sobe de 19 para cerca de 26.
4. Cada negócio conta uma vez só, mesmo ligado a mais de um cadastro. Nada é alterado nos negócios nem no CRM.
5. A regra é registrada na memória do projeto e na lista de tarefas.

## Como vou conferir
- Comparar os números do SBRO: os dois cards devem mostrar R$ 173.361,71 e 5 vendas.
- Testar outro evento para confirmar que não houve mudança fora do esperado.

## Detalhes técnicos
- `fn_event_lead_stats`: adicionar ganhos com `deals.origin_name` igual ao nome de um `smartops_forms` com `event_id` do evento (distinct por `piperun_deal_id`). Remover, para esses negócios, a condição `closed_at >= submitted_at`. Manter a prioridade do `event_sales` (NULLIF). Leads passam a ser a união dos envios com `event_id` e dos envios do formulário do evento. Vendedor do estande continua vindo do envio.
- `fn_form_metrics` / `fn_form_revenue`: quando o formulário tem `event_id`, ganhos e valor passam a vir de `deals.origin_name = nome do formulário`, status `ganha`. Formulários sem evento ficam com a regra atual.
- Atualizar a regra em `src/components/smartops/AGENTS.md`, sem alterar `fn_sync_normalized_from_lead` e as guardas do Painel Comercial.
