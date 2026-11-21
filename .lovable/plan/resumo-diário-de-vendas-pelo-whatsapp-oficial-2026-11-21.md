# Resumo diário de vendas pelo WhatsApp oficial

## O que vai chegar
Todo dia às 17:30 (horário de Brasília), o número oficial envia para **Danilo Henrique** (+55 19 99261-2348) e **Marcelo Del Guerra** (+55 16 99187-0988):

```text
Resumo Smart Dent - 20/11/2026

Leads gerados hoje: 42
- [Origem A]: 15
- [Origem B]: 10
- ...

Ganhos hoje: R$ 12.345,00 (3 negócios)
Ganhos no mês (01 a 20/11): R$ 187.000,00 (21 negócios)
```

Hoje, assim que terminar, faço um envio de teste para os dois.

## Regras dos números
- Leads do dia: leads únicos (sem duplicados mesclados) criados entre 00:00 e o envio, agrupados pela origem do primeiro contato.
- Ganhos: soma de `deals.value` (P&S + MRR) dos negócios fechados como ganhos no dia, pela data de fechamento — mesma regra do Painel Comercial.
- Mês: mesma soma do dia 1 até hoje.

## Limitação do WhatsApp oficial (importante)
A Meta só permite mensagem livre se a pessoa mandou algo para o número oficial nas últimas 24 h. Danilo e Marcelo já usam o número para a captura (AUTO/FIM), então em geral funciona. Quando a janela estiver fechada, o envio usa um modelo aprovado ("resumo_diario"), que eu crio agora; a aprovação da Meta pode levar até 48 h. Até lá, se um dos dois não falou com o número no dia, aquele envio falha e fica registrado.

## Detalhes técnicos
- Nova função `daily-sales-whatsapp-report`: calcula os números via RPC service-only `fn_daily_sales_report(date)` (lia_attendances com `merged_into IS NULL`; deals ganhos por `closed_at` em America/Sao_Paulo) e envia pelo Zernio usando a mesma conta oficial/cliente de `wa-field-capture`.
- Destinatários lidos de `team_members` pelos nomes/telefones acima (lista fixa na função).
- Tenta texto; em erro de janela 24 h, reenvia com template e registra resultado em `system_health_logs`; idempotência por data em `cron_state` para não enviar duas vezes.
- Agendamento pg_cron diário `30 20 * * *` (UTC = 17:30 SP), 1 vez por dia.
- Teste lógico do cálculo e envio manual imediato com `force=true`.
