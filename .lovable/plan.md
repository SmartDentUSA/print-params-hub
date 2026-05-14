# Disparador de SMS via DisparoPro na Central de Campanhas

Adicionar SMS como novo canal no wizard já existente em SmartOps → Central de Campanhas → Criar Campanha, integrando à API HTTP da DisparoPro (`https://apihttp.disparopro.com.br:8433`), com Bearer token, saldo e DLR via webhook.

## O que o usuário verá

Em **Criar Campanha**, o seletor "Canal de envio" ganha a opção **SMS (DisparoPro)**. Quando escolhido:

- **Etapa 1 — Conteúdo**: além da busca na biblioteca, surge um campo `Mensagem SMS` (textarea) com:
  - contador de caracteres e PDUs (160 / 153 por PDU em 7-bit; 70 / 67 em 16-bit; máx. 1377)
  - toggle `Codificação` (`0 = 7-bit padrão GSM` / `8 = 16-bit Unicode/acentos`)
  - badge de saldo da conta DisparoPro (lido via `GET /balance`)
  - variáveis suportadas: `{{nome}}`, `{{primeiro_nome}}`, `{{empresa}}` — preview ao vivo com 1 lead exemplo.
- **Etapa 2 — Segmentação**: filtros atuais inalterados; rodapé mostra "X leads com telefone normalizado válido / Y total" (filtra `telefone_normalized IS NOT NULL`).
- **Etapa 3 — Revisar**: card de resumo com canal SMS, codificação, preview da mensagem, contagem de leads, custo aproximado (PDUs × leads) e dois botões: **Salvar como rascunho** e **Disparar SMS agora**.

Na aba **Histórico**, campanhas SMS exibem por lead: `status` (Aguardando / Enviada / Entregue / Falha / Sem saldo) + `codigo_detalhe` + descrição da DisparoPro, atualizados via DLR.

## Como funciona (técnico)

### 1. Secret
Solicitar `DISPARO_PRO_TOKEN` (Bearer da conta DisparoPro). Opcional: `DISPARO_PRO_PARCEIRO_ID` se houver um ID fixo de parceiro; senão será o `campaign_id` curto.

### 2. Banco (migração)
- `campaign_sessions.channel` passa a aceitar `'sms'` (validação só no front; coluna já é `text`).
- Tabela `campaign_send_log` (criar se não existir, ou alterar):
  - `campaign_id uuid`, `lead_id uuid`, `telefone text`, `nome text`
  - `status text`, `error_message text`, `sent_at timestamptz`
  - **novas**: `provider text` (`'disparopro'`), `provider_message_id text`, `provider_status text` (`ACCEPTED|DELIVERED|UNKNOWN|...`), `provider_detail_code text` (`000`, `190`, …), `provider_detail_message text`, `mensagem_rendered text`, `parceiro_id text`
  - índice em `(provider, provider_message_id)` para casar com DLR.
- RLS: admins (`has_role(auth.uid(),'admin')`) leem/escrevem; edge functions usam service role.

### 3. Edge Functions (novas, `verify_jwt=false`, validam JWT no código)

**`smart-ops-sms-disparopro`** — POST `{ campaign_id }`:
1. Valida JWT + role admin.
2. Lê `campaign_sessions` + `lead_filters`.
3. Resolve leads em `lia_attendances` com `merged_into IS NULL` e `telefone_normalized` válido (10–13 dígitos, prefixo `55`).
4. Renderiza mensagem por lead (`{{primeiro_nome}}` etc.).
5. Envia em batches de **500** (limite da API é 10000) para `POST https://apihttp.disparopro.com.br:8433/mt` com Bearer token, payload Array:
   ```json
   [{"numero":"5511...","servico":"short","mensagem":"...","parceiro_id":"<campaign_id_curto>","codificacao":"0"}]
   ```
6. Persiste cada item de `detail[]` em `campaign_send_log` (mapeando `id`, `codigo_status`, `codigo_detalhe`, `descricao_detalhe`).
7. Atualiza `campaign_sessions` (`started_at`, `completed_at`, `sent_count`, `failed_count`, `status='completed'`).
8. Sleep 100 ms entre batches (rate limit defensivo).

**`smart-ops-sms-balance`** — GET: chama `GET /balance` e devolve `{ saldo }`. Cache de 60 s em memória.

**`smart-ops-sms-dlr`** — POST público (webhook DisparoPro): atualiza `campaign_send_log` por `provider_message_id` com novo `codigo_status` / `codigo_detalhe`. URL será informada para o usuário cadastrar em **DisparoPro → Integrações → Webhooks** (objeto `sms`, ação `dlr`).

Todas com CORS padrão (`npm:@supabase/supabase-js@2/cors`) e validação Zod.

### 4. Frontend
`src/components/SmartOpsCampaigns.tsx`:
- Novo `SelectItem value="sms"` em canal.
- Bloco condicional para SMS: textarea de mensagem, seletor de codificação, badge de saldo (fetch a `smart-ops-sms-balance`), preview renderizado.
- Step 3: botão "Disparar SMS agora" → cria `campaign_sessions` com `channel='sms'` e invoca `smart-ops-sms-disparopro` com o id retornado.
- `CampaignHistory`: quando `channel='sms'`, mostrar colunas `provider_status`, `codigo_detalhe`, `descricao_detalhe`.

### 5. Normalização / segurança
- Util `normalizeBrazilianPhone`: garante `55` + DDD + número; descarta inválidos antes do envio.
- Token nunca vai ao frontend; só o edge consome.
- Logar erros (sem token) em `system_health_logs`.

## Arquivos esperados
- `supabase/functions/smart-ops-sms-disparopro/index.ts` (novo)
- `supabase/functions/smart-ops-sms-balance/index.ts` (novo)
- `supabase/functions/smart-ops-sms-dlr/index.ts` (novo, público)
- `supabase/config.toml` (registrar as 3, `verify_jwt=false`)
- Migração SQL: colunas `provider*` em `campaign_send_log` + índice
- `src/components/SmartOpsCampaigns.tsx` (canal SMS, mensagem, saldo, disparo, histórico)

## Confirmar antes de implementar
1. Posso pedir o secret `DISPARO_PRO_TOKEN` agora?
2. Existe um `parceiro_id` fixo da sua conta DisparoPro ou uso o id curto da campanha?
3. MVP é disparo síncrono on-click (até ~5k leads por clique) — sem agendamento por enquanto. Ok?
4. Quer já habilitar o webhook DLR (precisarei te dar a URL para colar no painel DisparoPro)?