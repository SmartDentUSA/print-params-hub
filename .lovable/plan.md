## Objetivo

Duas mudanças na Central de Campanhas:

1. **Remover** o bloco de depoimento / prova social do e-mail gerado pela IA (Dra. Joyce e afins).
2. Colocar o envio de e-mails Gmail em uma **fila global inteligente** com limite de **499 envios/dia**, janela **07:30–19:00 (America/Sao_Paulo)**, round-robin entre todas as campanhas agendadas, e expor métricas de abertura e clique por campanha.

## 1. Remover prova social do e-mail

**`supabase/functions/smart-ops-generate-email-ai/index.ts`**
- Remover a query paralela em `success_stories` e `google_reviews`; remover a variável `proofBlock` e a seção "PROVA SOCIAL" do `userPrompt`.
- No `systemPrompt` remover a regra "OBRIGATÓRIO: se houver depoimento/review, incluir 1 bloco de prova social em itálico com o nome do cliente." e substituir por: "PROIBIDO incluir depoimentos, citações de clientes, blocos em itálico com nome de dentista, ou qualquer prova social. O e-mail vai direto do dossiê do produto ao CTA."
- Ajustar a estrutura sugerida no prompt para: saudação → hero image → hook → benefícios → CTA → rodapé Smart Dent (sem prova social).

## 2. Fila global 499/dia com round-robin

### 2.1 Migration
- Adicionar em `campaigns`: `send_window_start time default '07:30'`, `send_window_end time default '19:00'`, `daily_cap int default 499` (usado só para override futuro; a fila global usa 499 fixo hoje).
- Adicionar índice: `create index if not exists idx_campaign_send_log_queued on campaign_send_log (campaign_id, status) where status = 'queued';`
- Adicionar índice: `create index if not exists idx_campaign_send_log_gmail_sent_day on campaign_send_log ((sent_at at time zone 'America/Sao_Paulo')::date) where provider='gmail' and status='sent';`
- Nova RPC `fn_email_campaign_metrics(campaign_id uuid)` retornando `enviados`, `abertos`, `taxa_abertura`, `clicks`, `taxa_click`, `pendentes`, `erros` — computada em cima de `campaign_send_log` (colunas `opened_at`, `clicked_at`, `click_count` já existem).

### 2.2 `smart-ops-send-gmail` — modo enqueue
- Atualmente a função monta o público, cria a campanha e envia tudo em loop. Refatorar em três modos:
  1. `action: 'whoami'` (mantém).
  2. **`test_email` presente** → envia 1 mensagem imediatamente, sem tocar em campanhas (mantém comportamento atual).
  3. **`scheduled_at` presente OU envio normal** → cria a `campaigns` com `status='scheduled'`, resolve os leads, insere **todos** em `campaign_send_log` com `status='queued'` e retorna imediatamente (`sent=0, queued=N`). Nenhuma chamada Gmail nesse fluxo.
  4. Modo interno `action:'send_one', send_log_id` → executa uma única mensagem para uma linha `queued` (usado pelo cron). Faz placeholder replacement + short_links + pixel + Gmail send + update do log, exatamente como hoje.

### 2.3 Nova edge function `smart-ops-email-scheduler-tick`
- Chamada por pg_cron a cada 1 min.
- Passos:
  1. Ler hora atual em `America/Sao_Paulo`. Se fora de 07:30–19:00, sair.
  2. Contar sends do dia: `select count(*) from campaign_send_log where provider='gmail' and status='sent' and (sent_at at time zone 'America/Sao_Paulo')::date = current_date at tz`.
  3. `remaining = 499 - contados`. Se `<= 0`, sair.
  4. Selecionar campanhas ativas: `status in ('scheduled','sending') and (scheduled_at is null or scheduled_at <= now())` que ainda tenham log `queued`. Ordenar por `scheduled_at asc nulls first, created_at asc`.
  5. Round-robin: para cada campanha em ordem, pegar **1** `campaign_send_log` mais antigo com `status='queued'` e invocar `smart-ops-send-gmail` `action:'send_one'`. Marcar campanha como `status='sending'` no 1º envio.
  6. `budget_per_tick = min(remaining, campanhas_ativas)` — no máximo 1 por campanha por tick. Ticks a cada minuto ⇒ ~690 envios possíveis por janela (11,5h), suficiente para 499/dia mesmo com falhas.
  7. Se após enviar tudo da campanha não sobrar nenhum `queued`, marcar `campaigns.status='completed'` e `completed_at`.
  8. Retorna `{sent_this_tick, remaining_today, active_campaigns}`.
- Concurrency: usar advisory lock `pg_try_advisory_lock(hashtext('smartops-email-tick'))` na entrada; se não pegar, sair silencioso.

### 2.4 Agendamento via pg_cron
- Usar o supabase insert tool (não migration) para criar o job `smartops-email-tick` chamando a edge function a cada 1 minuto, com o anon key do projeto.
- O próprio job faz a checagem de janela horária; não precisa cron com faixa de horas.

### 2.5 UI — `EmailCampaignWizard.tsx` Step 4
- Trocar o aviso atual "⚠️ Limite Gmail padrão: ~500 envios/dia..." por um bloco explicativo:
  - "Fila inteligente: até **499 e-mails/dia**, entre **07:30 e 19:00**."
  - "Se houver várias campanhas ativas, a fila envia 1 e-mail de cada, em rodízio."
  - Mostrar em tempo real (query): `sent_today / 499` e nº de campanhas ativas na fila.
- Botão "Enviar agora" continua funcionando mas passa a **enfileirar** com `scheduled_at = now()` (mesmo caminho do agendado). Ao concluir, mostrar toast "Campanha enfileirada — X leads na fila".

### 2.6 UI — métricas por campanha (Step 5 novo bloco)
- Após enfileirar, exibir card "Métricas ao vivo" para essa campanha: **Enviados / Abertos (%) / Clicks (%) / Pendentes / Erros**, alimentado por `fn_email_campaign_metrics(campaign_id)` com polling a cada 30s enquanto o painel estiver aberto.
- Adicionar mesma seção no dashboard de campanhas existente (se houver `SmartOpsReports.tsx` ou similar; usar componente novo `EmailCampaignMetricsCard`).

## Fora de escopo
- Contadores por remetente (múltiplas contas Gmail). O cap 499 é global do único Gmail conectado.
- Fila para WhatsApp/SMS.
- Warm-up progressivo (podemos evoluir depois).

## Detalhes técnicos

Tabelas: `campaigns(status, scheduled_at, send_window_start, send_window_end, daily_cap)`, `campaign_send_log(status='queued'|'sent'|'error', opened_at, clicked_at, click_count, sent_at)`.

Ordem de envio por tick (pseudo):
```
lock -> if 07:30..19:00 -> remaining = 499 - sent_today
active = campaigns with queued rows, oldest scheduled_at first
for c in active: if remaining<=0 break
  pick oldest queued row of c -> send_one -> remaining--
```

Endpoint tracking já existe (`email-track-open`, `short-link-redirect` atualiza `clicked_at/click_count`), não muda.
