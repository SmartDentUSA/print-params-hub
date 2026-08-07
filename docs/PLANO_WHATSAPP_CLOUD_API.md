# WhatsApp Cloud API — backend e canal de campanha

Especificação do envio pela API Oficial da Meta no número de marketing.
Complemento de `PAINEL_TEMPLATES_WHATSAPP.md`, que cobre a aba de templates.

Registro de configuração e IDs: `INTEGRACAO_WHATSAPP_CLOUD_API.md`.

---

## Conta

Valores apurados em 06/08/2026. Não usar outros.

| Campo | Valor |
|---|---|
| WABA ID | `1289569149586649` — "Smart Dent Marketing" |
| Phone Number ID | `1242448845619620` — é este que a Cloud API usa |
| Número | +55 16 99750-1531 |
| App Meta | `1111860051255546` |

O número **já está em coexistência**: fica no app WhatsApp Business e na Cloud
API ao mesmo tempo, com `platform_type = CLOUD_API` e `is_on_biz_app = true`.
Não implementar Embedded Signup nem sincronização de histórico — esse trabalho
já foi feito.

Definir `GRAPH_API_VERSION` como constante única, nunca espalhada pelo código.
Conferir a versão corrente no App Dashboard antes de fixar.

---

## Limite que precisa aparecer na interface

O app está em `dev_mode` e não passou pelo App Review. Nesse estado a Meta só
entrega mensagem para até **5 números cadastrados como teste**.

A interface não pode sugerir que o disparo para a base está liberado. Aviso
fixo na aba de templates e no passo de disparo:

> App em modo de desenvolvimento — envio limitado aos números de teste
> cadastrados no App Dashboard.

Ordem que isso impõe ao projeto: o `api_precheck` do App Review **exige
chamadas de API já realizadas**. A integração técnica vem antes da aprovação,
não depois. O envio de teste é o que cumpre essa exigência.

---

## Secrets (Supabase)

| Nome | Origem |
|---|---|
| `WHATSAPP_CLOUD_TOKEN` | token de System User com acesso à WABA |
| `WHATSAPP_APP_SECRET` | App Dashboard → Configurações → Básico |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | string escolhida por nós, repetida no App Dashboard |

---

## Migrações

Tabelas que **já existem** e devem ser reaproveitadas, não recriadas:
`campaigns`, `campaign_segments`, `campaign_send_log`, `whatsapp_send_queue`,
`whatsapp_inbox`, `whatsapp_templates`.

```sql
-- campaigns já tem send_window_start, send_window_end e daily_cap.
-- Reutilizar; não duplicar.
alter table campaigns
  add column wa_template_name   text,
  add column wa_template_lang   text default 'pt_BR',
  add column wa_variable_map    jsonb default '{}',
  add column wa_phone_number_id text,
  add column send_days_of_week  int[] default '{1,2,3,4,5}',  -- 0=dom … 6=sáb
  add column messages_per_minute int default 10;

alter table whatsapp_send_queue
  add column template_name   text,
  add column template_params jsonb,
  add column wamid           text,
  add column campaign_id     uuid references campaigns(id);

alter table lia_attendances
  add column whatsapp_opt_out_at     timestamptz,
  add column whatsapp_opt_out_source text;
```

Colunas de `whatsapp_templates`: ver `PAINEL_TEMPLATES_WHATSAPP.md`.

---

## Edge functions

Todas com `verify_jwt = false` no `config.toml` — a Meta chama sem JWT.

### `smart-ops-whatsapp-webhook`

**GET** — responder o desafio de verificação (`hub.mode`, `hub.verify_token`,
`hub.challenge`), comparando com `WHATSAPP_WEBHOOK_VERIFY_TOKEN`.

**POST** — validar `X-Hub-Signature-256` com `WHATSAPP_APP_SECRET` **antes de
processar qualquer coisa**. Assinatura inválida responde 401 sem processar.

Tratar os campos: `messages`, `statuses`, `message_template_status_update`,
`smb_message_echoes`.

Gravar em `whatsapp_inbox` usando as colunas que já existem: `phone`,
`phone_normalized`, `direction`, `wa_message_id`, `lead_id`, `matched_by`,
`instance_name`, `raw_payload`.

Deduplicar por `wamid`: a Meta reenvia o mesmo evento quando não recebe 200.
Responder 200 sempre que a assinatura for válida.

Casar telefone com lead pelos últimos 9 dígitos, como `dra-lia-whatsapp` já faz.

`smb_message_echoes` entrega o que for digitado no celular — é o que permite
registrar no CRM conversas hoje invisíveis.

### `smart-ops-whatsapp-send`

```
POST /{GRAPH_API_VERSION}/1242448845619620/messages
```

Aceita `type: 'text'` (texto livre, válido só dentro da janela de 24 h) e
`type: 'template'` (`template_name`, `language`, `components`).

Gravar o `wamid` retornado. Erro da Meta deve ser gravado legível, com a
mensagem, não apenas o código HTTP.

### `smart-ops-whatsapp-templates-sync`

```
GET /{GRAPH_API_VERSION}/1289569149586649/message_templates
```

Popula `whatsapp_templates`. Detalhes em `PAINEL_TEMPLATES_WHATSAPP.md`.

### `smart-ops-whatsapp-campaign-tick`

Drena `whatsapp_send_queue` onde `provider = 'cloud_api'` e status pendente,
respeitando, em ordem:

- `send_window_start` / `send_window_end`
- `send_days_of_week`
- `messages_per_minute`
- `daily_cap`
- **teto de 20 mensagens por segundo** — limite fixo do número em coexistência,
  nunca ultrapassar mesmo que `messages_per_minute` peça mais

Fora da janela ou do dia permitido: não envia, deixa na fila.
Nunca enviar para lead com `whatsapp_opt_out = true`.

---

## Canal novo no wizard de campanha

Arquivo: `src/components/SmartOpsCampaigns.tsx`. O wizard tem três passos —
1 dados e mensagem, 2 segmentação, 3 revisão e envio. Manter a estrutura.

### Passo 1 — canal e template

O seletor "Canal de envio" hoje oferece:

```
WhatsApp (Evolution) | SMS (DisparoPro) | Email (Gmail) | Apenas registrar
```

Acrescentar: **API Oficial Meta**.

Ao escolher, abrir um bloco no mesmo lugar e com o mesmo padrão visual do
bloco que hoje aparece para SMS:

- select com os templates de `whatsapp_templates`, **apenas `APPROVED`**;
  `PENDING` e `REJECTED` não podem ser escolhidos
- prévia do corpo do template escolhido
- para cada variável (`{{1}}`, `{{2}}`…), escolher a origem:
  - **coluna do lead** — muda por destinatário
  - **valor fixo da campanha** — mesmo texto para todos

Salvar em `campaigns.wa_variable_map` com o tipo explícito:

```json
{
  "1": { "tipo": "coluna", "valor": "nome" },
  "2": { "tipo": "fixo",   "valor": "Impressora 3D RayShape Edge Mini" }
}
```

Quando a origem for coluna, mostrar ao lado **quantos leads do segmento têm
aquele campo preenchido**. Variável vazia faz a Meta rejeitar o envio.

A medição que sustenta essa regra está em `PAINEL_TEMPLATES_WHATSAPP.md`.

### Passo 2 — segmentação

Sem mudança. Continua usando `campaign_segments` e o `SmartOpsAudienceBuilder`
que já existem.

### Passo 3 — parâmetros de disparo

Antes da revisão de envio, acrescentar o bloco **"Parâmetros de disparo"**,
visível apenas para o canal API Oficial Meta:

| Campo | Coluna |
|---|---|
| Janela de horário (início e fim) | `send_window_start` / `send_window_end` |
| Dias da semana (seleção múltipla) | `send_days_of_week` |
| Mensagens por minuto | `messages_per_minute` |
| Limite diário | `daily_cap` |

Mostrar a estimativa calculada: com N leads, X mensagens por minuto e a janela
escolhida, o disparo leva aproximadamente Y e termina em Z.

Mostrar também o teto do número: 20 mensagens por segundo.

Botão de **envio de teste para um número único** antes do disparo real. É ele
que cumpre o `api_precheck` e serve de gravação para o vídeo do App Review.

---

## Opt-out — obrigatório

Todo template de categoria `MARKETING` precisa de botão de saída
("Parar promoções"). Ao receber esse clique no webhook, gravar no lead:

```
whatsapp_opt_out        = true
whatsapp_opt_out_at     = now()
whatsapp_opt_out_source = 'template_button'
```

O tick de envio nunca envia para lead com opt-out.

Isso não é formalidade: reclamação e bloqueio são o que derruba a avaliação de
qualidade do número, hoje em GREEN.

---

## Não fazer

- Não mexer no canal Evolution nem no fluxo de Grupos WA. O Evolution continua
  responsável pelos grupos e pelas conversas dos vendedores.
- Não implementar Groups API. Grupos não são suportados para números vindos do
  app WhatsApp Business, que é o caso deste — e o limite seria de 8
  participantes.
- Não implementar Embedded Signup: o número já está em coexistência.
- Não criar tabela nova para templates, segmentos ou fila — todas já existem.
- Não tocar em `LeadDetailPanel.tsx` nem nas integrações PipeRun/SellFlux.

---

## Fora do escopo deste documento

O fluxo passivo — webhook identificando o lead, resolvendo o produto a partir
da mensagem e conduzindo a qualificação — é um bloco independente e será
especificado à parte.
