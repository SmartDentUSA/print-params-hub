# Prefixo "🤖 Novo Lead - Dra. L.I.A." em mensagens para vendedores

## Situação verificada

- Busca no repositório (`supabase/`, `src/`): a string `Novo Lead atribuído` / `🤖 Novo Lead - Dra. L.I.A.` **não existe** em nenhum arquivo (código, templates, migrations recentes).
- Código atual de briefing para vendedor em `supabase/functions/_shared/waleads-messaging.ts` (linhas 310 e 1406) já monta o header como `📊 *Análise SmartOps*`.
- Nenhuma regra em `cs_automation_rules`, `reactivation_rules`, `whatsapp_templates` contém o prefixo antigo.
- `whatsapp_inbox` (direction=outbound): última mensagem com `Novo Lead atribuído - Dra. L.I.A.` é de **12/05/2026 20:44** — 292 ocorrências no total, **zero após essa data**.

Conclusão: o fix já está em produção há ~2 meses. A mensagem que você está vendo hoje no WhatsApp do 5519992612348 provavelmente é:
1. Uma mensagem antiga (rolagem do histórico), ou
2. Um envio de outra origem que ainda não mapeei (ex: script externo, N8N, Make, ManyChat, ou uma edge function chamada por webhook que não usa `waleads-messaging.ts`).

## Preciso confirmar antes de propor mudança

Antes de eu abrir um plano de correção, me confirme:

1. **Data/hora exata** da última mensagem que você viu com esse prefixo (screenshot ajuda).
2. **Vendedor destinatário** (whatsapp do vendedor que recebeu).

Com isso eu:
- Localizo o registro real em `whatsapp_inbox` / logs do Evolution e identifico qual função disparou (pelo `trigger_source` / `created_at` / metadados).
- Se for envio recente de fato, encontro o call-site restante e corrijo o header para `📊 SmartOps`.
- Se for mensagem antiga, apenas confirmo que não há mais envio ativo.

Aguardo os dois dados para prosseguir com um plano de correção direcionado.
