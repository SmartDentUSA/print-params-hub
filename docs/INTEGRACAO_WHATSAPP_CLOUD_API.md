# Integração WhatsApp Cloud API (oficial) — Sistema B

Registro da configuração levantada em 06/08/2026. **Este documento é a fonte da verdade
dos IDs** — o Gerenciador do WhatsApp mostra "Identificação" para coisas diferentes e é
fácil confundir conta com número.

---

## Objetivo

Enviar mensagens pelas automações do Sistema B usando os **números oficiais dos vendedores**,
pela Cloud API da Meta, **sem Evolution** e **sem que o vendedor perca o WhatsApp no celular**.

O recurso que permite isso chama-se **Coexistência** (*Coexistence* / "Onboard WhatsApp
Business app users"): o mesmo número fica no app WhatsApp Business **e** na Cloud API, com
contatos e histórico sincronizados.

---

## Estado apurado (06/08/2026)

### Número piloto — Smart Dent Marketing

| Campo | Valor |
|---|---|
| WABA (conta) | `1289569149586649` — "Smart Dent Marketing" |
| **Phone number ID** (é este que a Cloud API usa) | **`1242448845619620`** |
| Número | `+55 16 99750-1531` |
| `verified_name` | Smart Dent Marketing |
| `platform_type` | **`CLOUD_API`** |
| `is_on_biz_app` | **`true`** |
| `quality_rating` | **GREEN** |

**Leitura**: o número **já está em coexistência**. O Embedded Signup de coexistência, a
sincronização de histórico e a janela de 24 h para sincronizar **não são necessários** —
esse trabalho já foi feito.

### Quem já está assinado na WABA

`GET /1289569149586649/subscribed_apps` retorna apenas:

```json
{ "whatsapp_business_api_data": { "name": "Business Agent", "id": "1143680903703001",
                                  "link": "https://whatsapp.com/" } }
```

`Business Agent` é o app **interno da Meta** que faz a ponte da coexistência com o app do
celular. **Nenhum BSP está conectado** — o WaLeads não está nessa WABA. O caminho para
assinar o app próprio está livre.

### App Meta

| Campo | Valor |
|---|---|
| App | `1111860051255546` — "SmartDent Sistema B WApp" |
| Status | `dev_mode`, `is_live: false` |
| Verificação da empresa | ✅ aprovada |
| Política de privacidade | ❌ ausente (`has_privacy_policy: false`) |
| Ícone / categoria / e-mail verificado | ❌ / genérica (`ALL`) / ❌ |
| App Review | submissão aberta, **todos os passos incompletos** |

Passos pendentes em `whatsapp_business_messaging` **e** `whatsapp_business_management`:
`use_case`, `screencast`, `api_precheck`, `data_use_checkup`.

`can_submit: false` — motivo: *"Cannot submit to App Review while a previous submission is
in review"*. A submissão aberta precisa ser completada pelo botão **Editar análise do app**.

> `api_precheck` exige **chamadas reais de API já feitas** por este app. Ou seja: a
> integração técnica vem **antes** da aprovação, não depois.

### Outras WABAs da BM (um número por vendedor)

Cada linha do Gerenciador é uma WABA distinta: Smart Dent Marketing, Adriano, Evandro,
Lucas Fontana, Paulo Smartdent, Pós-venda (Paula), Janaina Ap dos Santos, Thiago Godoy.
Os IDs mostrados na tela são das **contas**, não dos números — o phone number ID sai de
`GET /<WABA_ID>/phone_numbers`.

---

## Conflito a administrar: Evolution no mesmo número

`+55 16 99750-1531` está hoje em `team_members` como **"Smart Dent | 16 anos"** com
`messaging_provider = 'evolution'` e `evolution_status = 'connected'`.

O número está **simultaneamente** no Evolution (dispositivo pareado) e na Cloud API. Quando
o webhook subir, cada mensagem gera evento nos dois caminhos. A virada tem que ser:

1. webhook da Cloud API no ar e validado
2. confirmar que os eventos chegam
3. desligar o envio pelo Evolution para esse número
4. só então trocar `messaging_provider` para `cloud_api`

Também vale lembrar: ao reconectar a coexistência, a Meta restaura só o companion da Cloud
API — **outros dispositivos vinculados (WhatsApp Web / Evolution) precisam ser re-pareados
manualmente**.

---

## Regras da Cloud API que mudam o desenho das automações

- **Janela de 24 h**: fora dela só template aprovado. Mensagem enviada **pelo celular do
  vendedor não abre nem estende** a janela da API.
- **Throughput fixo de 20 mensagens/segundo** em número com coexistência.
- **Grupos não são suportados** pela API. Editar/apagar mensagem deixa de funcionar.
- Mensagem pelo app continua **grátis**; pela API é **cobrada por conversa**.
- Webhook `smb_message_echoes` entrega as mensagens que o vendedor digita no celular —
  é o que permite registrar no CRM conversas hoje invisíveis.

---

## Arquitetura no Sistema B

### Secrets (Supabase)

| Nome | Origem |
|---|---|
| `WHATSAPP_CLOUD_TOKEN` | token de System User com acesso à WABA |
| `WHATSAPP_APP_SECRET` | App Dashboard → Configurações → Básico |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | string escolhida por nós, repetida no App Dashboard |

### Edge functions

| Função | Papel |
|---|---|
| `smart-ops-whatsapp-webhook` | `GET` responde ao desafio de verificação; `POST` valida `X-Hub-Signature-256` e ingere `messages`, `statuses` e `smb_message_echoes` |
| `smart-ops-whatsapp-send` | envia texto (dentro da janela de 24 h) ou template (fora dela) |

Ambas com `verify_jwt = false` no `config.toml` — a Meta chama sem JWT.

### Banco

`team_members` ganha `wa_phone_number_id` e `wa_waba_id`; `messaging_provider` passa a
aceitar `cloud_api` ao lado de `waleads` e `evolution`. A migração é número a número.

Mensagens entram em `lead_activity_log` (`event_type = 'whatsapp_message'`), com
`dedupe_hash` a partir do `wamid` para não duplicar em reentrega de webhook — a Meta
reenvia o mesmo evento quando não recebe `200`.

---

## Sequência até o número piloto em produção

| # | Passo | Onde |
|---|---|---|
| 1 | Página de política de privacidade publicada | Sistema B (Lovable) |
| 2 | Ícone, categoria e e-mail verificado no app | App Dashboard |
| 3 | Edge functions de webhook e envio | Sistema B (Lovable) |
| 4 | Callback URL + verify token + assinar campos do webhook | App Dashboard → WhatsApp → Configuration |
| 5 | `POST /1289569149586649/subscribed_apps` | Graph API |
| 6 | Token permanente de System User | Business Settings |
| 7 | Envio de teste com `1242448845619620` → cumpre `api_precheck` e serve de vídeo | Sistema B |
| 8 | Completar `use_case` + `data_use_checkup` e submeter App Review | App Dashboard |
| 9 | Desligar Evolution nesse número e virar `messaging_provider` | Sistema B |

Até o passo 9 o Evolution segue funcionando normalmente.

---

## Consultas úteis (Graph API Explorer)

```
# número(s) de uma WABA — de onde sai o phone number ID
1289569149586649/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating,platform_type,is_on_biz_app

# quem recebe webhooks dessa WABA
1289569149586649/subscribed_apps

# contas de WhatsApp da BM
<BUSINESS_ID>/owned_whatsapp_business_accounts?fields=id,name

# descobrir o tipo de um ID qualquer
<ID>?metadata=1&fields=id,name
```
