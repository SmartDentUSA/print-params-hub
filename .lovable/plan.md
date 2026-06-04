## Diagnóstico

O PipeRun não está parado: o webhook `smart-ops-piperun-webhook` recebeu eventos até `04/06 02:40:43 UTC`.

O problema é que os eventos recentes estão sendo descartados antes de atualizar `lia_attendances`:

- Últimos eventos do deal `56872930` chegaram no webhook.
- Resultado registrado em `piperun_webhook_events`: `skipped_no_email`.
- Erro: `deal_without_email_after_hydration`.
- A função hidrata o deal via API PipeRun, mas a versão hidratada vem sem contatos e sobrescreve o payload original que tinha:
  - `person.contact_emails`: `marcosptavares.paulo@gmail.comm`
  - `person.contact_phones`: `5515991478813`
  - `person.fields`: `ID Banco de Dados = 6843`
- Como o e-mail/telefone somem depois da hidratação, a função entende que não há identidade e ignora o evento.

Também há um segundo risco: o e-mail no PipeRun está com typo `.comm`, enquanto o CDP tem `marcosptavares.paulo@gmail.com`. Se eu só preservar o contato sem normalizar, o sistema pode criar/vincular errado ou duplicar.

## Plano de correção

1. Ajustar a hidratação do PipeRun
   - Em `supabase/functions/_shared/piperun-deal-hydrate.ts`, preservar `person.contact_emails`, `person.contact_phones`, `company.contact_emails` e `company.contact_phones` do webhook quando a resposta hidratada vier vazia.
   - Evitar que a hidratação apague identidade válida enviada pelo próprio PipeRun.

2. Fortalecer resolução de identidade no webhook
   - Em `supabase/functions/smart-ops-piperun-webhook/index.ts`, normalizar e-mail antes de buscar/criar lead.
   - Corrigir typos comuns e seguros como `gmail.comm` → `gmail.com`.
   - Buscar também por `astron_email`, não apenas por `email`, respeitando `merged_into IS NULL`.
   - Usar telefone normalizado como fallback depois de pessoa/e-mail.

3. Extrair campos úteis que hoje estão sendo ignorados
   - Ler `person.fields` além de `custom_fields/customFields`.
   - Capturar `ID Banco de Dados` para `id_cliente_smart` quando existir.
   - Isso melhora o vínculo de casos vindos de curso/Astron/CS.

4. Reprocessar os eventos recentes ignorados
   - Após o ajuste, criar uma forma segura de reprocessar os últimos eventos `skipped_no_email` do PipeRun usando o `raw_payload` salvo em `piperun_webhook_events`.
   - Começar pelo deal `56872930` e validar que ele vincula no lead canônico `af81dcd1-48f6-408c-8f53-a5576c96a30e`, sem criar duplicata.

5. Validar
   - Conferir logs do edge function.
   - Conferir `piperun_webhook_events` saindo de `skipped_no_email` para `updated`.
   - Conferir `lia_attendances` do Marcos com `piperun_id=56872930`, `pessoa_piperun_id=44688425`, histórico de deals e dados CS Onboarding preenchidos.

## Arquivos previstos

- `supabase/functions/_shared/piperun-deal-hydrate.ts`
- `supabase/functions/smart-ops-piperun-webhook/index.ts`

## Resultado esperado

O webhook volta a aceitar eventos PipeRun com payload parcial/hidratado sem perder identidade, vincula o Marcos corretamente ao lead existente e reduz os descartes `deal_without_email_after_hydration` sem abrir brecha para duplicação.