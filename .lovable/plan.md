## Objetivo

Normalizar dados de leads vindos do Meta Ads e gravar no Piperun com origem correta — separando dois conceitos:

1. **Origem da Pessoa** = primeiro contato dela com a Smart Dent (imutável depois de criada).
2. **Origem do Deal** = campanha/formulário específico que gerou aquela oportunidade (uma pessoa pode gerar N deals com origens diferentes).

## Conceitos

| Conceito | Quando é definido | Pode mudar? | Exemplo |
|---|---|---|---|
| **Pessoa.origem** | Primeira vez que entra (qualquer canal) | Não — congelada após criação | "Meta Ads — Campanha Anycubic Frio (Mar/26)" |
| **Deal.origem** | A cada novo deal criado | Sim — cada deal tem a sua | Deal 1: "Meta — Anycubic Frio"; Deal 2: "Form Site — Trial Resina"; Deal 3: "Meta — Black Friday Scanner" |

Hoje o código não trata isso: `lia-assign` usa `resolveOriginId(form_name)` apenas no `origin_id` do **deal**, e o **pessoa** é criada sem origin (depois herda automaticamente do primeiro deal no Piperun, sem controle nosso).

## Mudanças no Webhook Meta (`smart-ops-meta-lead-webhook`)

Enriquecer payload com chamadas Graph API:
```
GET /{leadgen_id}?fields=field_data,form_name,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,created_time,platform
```

Campos adicionados ao payload normalizado enviado para `ingest-lead`:
- `form_name` = `campaign_name` (vira a origem do deal)
- `origem_campanha` = `campaign_name`
- `utm_campaign` / `utm_content` / `utm_term` = campaign / ad / adset names
- `meta_campaign_id`, `meta_campaign_name`, `meta_adset_id`, `meta_adset_name`, `meta_ad_id`, `meta_ad_name`
- `produto_interesse` = mapeado a partir de respostas do form ou nome da campanha (cascata: resposta direta > inferência por keywords > nome da campanha)

## Mudanças no Banco (`lia_attendances`)

Adicionar coluna **`origem_primeiro_contato`** (text) — congelada na primeira inserção. Lógica:
- INSERT de novo lead: grava `origem_primeiro_contato = origem_campanha` (ou source padrão).
- UPDATE em lead existente (reativação): **nunca** sobrescreve `origem_primeiro_contato`. Só atualiza `origem_campanha` (que reflete a campanha mais recente).

Trigger: `BEFORE UPDATE` em `lia_attendances` que protege `origem_primeiro_contato` de qualquer overwrite após o primeiro INSERT.

## Mudanças no Piperun (`smart-ops-lia-assign` + `piperun-hierarchy`)

### Cache de origens
Manter `originCache: Map<name, origin_id>` em `_shared/piperun-origins.ts` (extrair da `lia-assign`) com função `resolveOriginId(apiToken, originName)` — cria/reusa origem por nome. Reusada por:
- Person create (passa `origem_primeiro_contato`)
- Deal create (passa `origem_campanha` — campanha desse deal específico)

### Person Create (`piperun-hierarchy.createPerson`)
```ts
const personOriginId = await resolveOriginId(apiToken, lead.origem_primeiro_contato);
personPayload.origin_id = personOriginId; // congela origem da pessoa
```

### Person Update (`updatePersonFields`)
**NUNCA** envia `origin_id` no PUT — preserva a origem original da pessoa no Piperun.

### Deal Create (`createNewDeal`)
```ts
const dealOriginId = await resolveOriginId(apiToken, lead.origem_campanha || lead.form_name);
dealPayload.origin_id = dealOriginId; // origem específica deste deal
```
Hoje hardcoded para `ORIGINS.DRA_LIA.id` em `piperun-hierarchy.ts` linhas 188/216/247 — substituir pelo `dealOriginId` resolvido por campanha. Manter `DRA_LIA` apenas como fallback se `origem_campanha` for nulo.

### Deal Reativado (`moveDealToVendas` / `updateExistingDeal`)
Quando reativa, atualiza o `origin_id` do deal para a campanha que disparou a reativação (afinal, é uma nova oportunidade triggada por nova campanha). O deal antigo "Estagnados" já tinha sua origem original; a reativação representa novo touchpoint.

## Fluxo final

```text
Meta → meta-lead-webhook
  └─ Graph API: campaign_name, ad_name, adset_name, form fields
       │
       ▼
ingest-lead
  ├─ Lead novo → INSERT lia_attendances
  │   ├─ origem_primeiro_contato = "Meta — {campaign_name}"
  │   ├─ origem_campanha          = "Meta — {campaign_name}"
  │   └─ trigger lia-assign(novo)
  │         └─ Piperun:
  │             - Person create: origin = origem_primeiro_contato
  │             - Deal   create: origin = origem_campanha
  │
  └─ Lead existente → UPDATE lia_attendances
      ├─ origem_primeiro_contato = (preservado pelo trigger)
      ├─ origem_campanha          = "Meta — {campaign_name nova}"
      └─ trigger lia-assign(sdr_captacao_reativacao)
            └─ Piperun:
                - Person update: SEM origin_id
                - Deal reativado: origin = origem_campanha (nova)
                - OU Deal novo: origin = origem_campanha (nova)
```

## Detalhes técnicos

- Migration:
  - `ALTER TABLE lia_attendances ADD COLUMN origem_primeiro_contato text;`
  - Backfill: `UPDATE lia_attendances SET origem_primeiro_contato = origem_campanha WHERE origem_primeiro_contato IS NULL;`
  - Trigger `protect_origem_primeiro_contato` BEFORE UPDATE: se `OLD.origem_primeiro_contato IS NOT NULL`, força `NEW.origem_primeiro_contato = OLD.origem_primeiro_contato`.

- Cache de campanhas Meta (opcional fase 2): tabela `meta_campaign_cache` para evitar chamadas Graph repetidas e permitir admin sobrescrever `produto_interesse_default` por campanha.

- Note do deal recém-criado (já gerada por `buildNotification`): adicionar bloco "📣 Meta Ads — Campanha: {nome} | Ad: {nome} | Adset: {nome}".

## Validação após deploy

1. Webhook teste com `leadgen_id` real → conferir nos logs `campaign_name` capturado e gravado em `origem_campanha` + `origem_primeiro_contato`.
2. Piperun: pessoa nova criada com origem = nome da campanha.
3. Mesma pessoa preenche outro form (site, ex.) → criar segundo deal com origem diferente, **sem** mudar origem da pessoa.
4. Lead Meta repetido → deal reativado com `origin_id` atualizado para nova campanha; pessoa permanece com origem original.

## Fora de escopo

- Backfill retroativo de `person.origin_id` no Piperun (apenas leads novos a partir do deploy).
- Painel admin para editar mapeamento campanha → produto (fase 2).
