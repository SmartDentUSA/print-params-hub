## Objetivo

Permitir que uma mesma régua em Central de Campanhas → Grupos WhatsApp inclua grupos das duas instâncias conectadas (`smartdent_marketing` e `cs_principal`) — hoje o seletor força escolher uma só, filtrando tudo por `instance_name`.

## Por que é seguro no back-end

O `wa-dispatcher` já resolve a instância **por grupo**: em `wa_groups.instance_name` cada JID sabe de qual instância veio, e o dispatcher busca `evolution_api_key` do `team_members` correspondente (`tmByInstance` na linha 94-100 de `supabase/functions/wa-dispatcher/index.ts`). Portanto uma régua misturada (grupos de instâncias diferentes) já funciona no envio — falta apenas destravar a UI.

## Mudanças (apenas front-end)

### 1. `src/components/smartops/wa-groups/SmartOpsWaGroupCampaigns.tsx`
- Adicionar opção **"Todas conectadas"** no `<Select>` de instância (`selectedInstance = ""`).
- `fetchRows()`: quando `selectedInstance` for vazio, **não** aplicar `.eq("instance_name", ...)` — traz grupos de todas as instâncias.
- `fetchShared()`: quando vazio, não filtrar links por instância.
- `handleSync()`: já trata vazio (sincroniza todas). Mantém.
- Default inicial: continuar priorizando primeira instância `open`, mas guardar a preferência em `localStorage` para o usuário não perder a escolha "Todas conectadas".

### 2. `src/components/smartops/wa-groups/WaGroupMultiSelect.tsx`
- Já suporta `instanceFilter` undefined (linha 41). Passar `undefined` quando `selectedInstance === ""`.
- Renderizar um badge com `instance_name` ao lado do nome do grupo **quando não há filtro** — ajuda o usuário a saber de qual instância cada grupo veio. Quando há filtro, esconde o badge (redundante).

### 3. Listagem de grupos na tela principal (rows)
- Adicionar coluna/badge `instance_name` também na tabela principal quando `selectedInstance === ""`, para consistência visual com o multi-select.

## Não muda

- `wa-dispatcher`, `_shared/evolution.ts`, `WaGroupMultiSelect.tsx` lógica de dedup/cooldown, RPCs, schema, edge functions.
- Nada é alterado no Evolution self-hosted nem nas apikeys.
- O botão "Sincronizar" com "Todas" continua sincronizando todas as instâncias (comportamento atual quando `body` é `{}`).

## Validação

1. Selecionar "Todas conectadas" → conferir que grupos de `smartdent_marketing` e `cs_principal` aparecem juntos com badge da instância.
2. Criar régua mista (1 grupo de cada instância) → checar em `wa_message_queue` que o `wa-dispatcher` enviou usando a apikey correta de cada `team_member` (log `[v66eg] OK` sem `SessionError`).
3. Selecionar "smartdent_marketing" ou "cs_principal" individualmente → comportamento antigo preservado, badge de instância some.