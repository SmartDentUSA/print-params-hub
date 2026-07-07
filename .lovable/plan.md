## Diagnóstico

O erro **"Edge Function returned a non-2xx status code"** vem da função `campaign-execute-sms`, que retorna `400 — Audiência vazia — nenhum lead encontrado`.

- Frontend calcula corretamente **4.242 leads válidos** para `area_atuacao = 'LABORATÓRIO DE PRÓTESE'` (query direta em `lia_attendances`).
- A edge function `campaign-build-audience` (usada internamente por `campaign-execute-sms`), porém, retorna `0` para o mesmo filtro. As duas edge functions foram criadas direto no Supabase e não estão versionadas no repositório, então não é possível corrigir o filtro delas por código aqui.
- Resultado: o disparo aborta antes de chamar a DisparoPro.

## Correção

O projeto já tem um pipeline SMS **funcional e versionado**: `smart-ops-sms-disparopro`, que lê `campaign_sessions.lead_ids` + `results.sms_message/sms_codificacao` e dispara na DisparoPro (memory *Copilot SMS + CS WhatsApp*).

Vou fazer o botão "Disparar SMS agora" usar esse pipeline em vez do `campaign-execute-sms` quebrado — o cálculo de leads da UI (4.242) passa a ser fonte de verdade também no backend, eliminando o bug de filtro server-side.

### Mudanças em `src/components/SmartOpsCampaigns.tsx`

1. **Novo helper `resolveSmsLeadIds()`**: refaz a mesma query já usada por `smsLeadValidCount` (`lia_attendances` + `merged_into IS NULL` + `telefone_normalized NOT NULL` + `sms_opt_out ≠ true` + filtros atuais), mas trazendo `id` em vez de count. Paginação em blocos de 1000 (Supabase limit) até esgotar, capado em 10 000 para segurança.
2. **`handleSendSms` reescrito** (mantém validações, toasts e `campaigns` draft já existentes):
   - Resolve `lead_ids` via helper acima; se `0`, aborta com toast claro ("Nenhum lead com telefone válido para os filtros").
   - Cria uma linha em `campaign_sessions` com:
     - `name` = `campaignName`
     - `channel = 'sms'`
     - `lead_ids` = array resolvido
     - `status = 'running'`
     - `results = { sms_message, sms_codificacao, source_campaign_id: <id do draft em campaigns> }`
   - Invoca `smart-ops-sms-disparopro` com `{ campaign_id: <id da campaign_session>, sms_message, sms_codificacao }`.
   - Lê `sent`, `failed`, `per_lead` do retorno e reflete no toast (mesma UX de hoje).
   - Marca o draft em `campaigns` como `status='completed'` (ou `sent`) só depois do disparo, para não perder rastreabilidade da UI atual.
3. **Nada muda no fluxo WhatsApp/Evolution**, nas telas de preview ou nos cards de custo/preview — apenas o handler de envio SMS.

### Fora de escopo

- Não vou mexer nas edge functions `campaign-execute-sms` / `campaign-build-audience` (não versionadas). Uma nota pode ser adicionada em memory dizendo que o SMS agora ignora essas funções.
- Não vou tocar em `wa-dispatcher`, `wa-evolution-diag` ou nas mensagens WA travadas — assunto separado.

## Riscos

- `smart-ops-sms-disparopro` faz `fetch` sequencial por lead. Para 4.242 leads é lento mas dentro do orçamento (usa `Deno.serve` sem `EdgeRuntime.waitUntil`; edge function pode passar dos 150s wall-clock). Se virar problema real em produção, próxima iteração fatia por batches e usa `waitUntil` + polling — deixo essa evolução para depois do primeiro disparo bem-sucedido.
- Cap de 10 000 lead_ids protege contra listas absurdas; se precisar maior, ajustamos.

## Validação

Após a mudança:
1. Repetir o disparo pela UI ("exocad DentalCad RMS", 4.242 leads).
2. Confirmar toast `Disparo completed: X/4242 enviados, Y falhas` e linha nova em `campaign_sessions` com `results.sent`.
3. Amostrar 2-3 linhas em `message_logs` com `tipo='sms_disparopro'` e `status='aceito_provider'`.
