## Diagnóstico confirmado

O caso do lead **Robespierre Gomes Souza** mostra a falha:

- Lead canônico: `1ab45609-a8f2-4cec-ba81-83b1e35b223f`
- Re-entrega Meta/ formulário em `02/07/2026 11:06 UTC`
- Deal antigo aberto em **Funil Estagnados / Etapa 01 - Reativação**: `#60055732`
- Sistema criou indevidamente novo deal em **Funil de vendas / Sem contato**: `#61508533`
- Evento gravado: `deal_reativado_via_formulario`
- Origem técnica: `smart-ops-ingest-lead` chamou `smart-ops-lia-assign` com `trigger = sdr_captacao_reativacao`; dentro de `executarReativacaoSdrCaptacao`, ao encontrar deal aberto em Estagnados e nenhum VENDAS recente, criou novo deal em VENDAS.

Isso viola a regra: **não reabrir / não criar deal novo sem nova interação real ou novo formulário comprovado**.

## Correção cirúrgica

### 1. Bloquear reativação automática por `sdr_captacao_reativacao`
Em `supabase/functions/smart-ops-lia-assign/index.ts`:

- Alterar o bloco `if (trigger === "sdr_captacao_reativacao")` para **não executar criação/movimentação de deal por padrão**.
- Só permitir esse fluxo se o caller enviar uma prova explícita e segura de conversão nova, por exemplo:
  - `new_conversion_confirmed === true`
  - e `conversion_key` não processada antes
  - e origem não for re-entrega Meta conhecida
- Sem essa prova: retornar `skipped: true`, motivo `sdr_captacao_blocked_no_new_conversion`.
- Registrar apenas log interno em `system_health_logs`, sem nota no PipeRun e sem update no CRM.

### 2. Remover gatilho automático de reativação no ingest
Em `supabase/functions/smart-ops-ingest-lead/index.ts`:

- Parar de transformar automaticamente qualquer `form_purpose = sdr_captacao` + `existingLead` em `trigger = sdr_captacao_reativacao`.
- Para lead existente, o padrão passa a ser:
  - enriquecer CDP;
  - atualizar `form_data` / campos internos;
  - não criar deal;
  - não mover funil;
  - não postar nota.
- Só enviar `trigger = sdr_captacao_reativacao` quando houver conversão nova comprovada por chave idempotente inédita.

### 3. Criar chave idempotente de conversão real
Ainda no ingest:

- Calcular uma `conversion_key` estável:
  - Meta: `meta:${platform_form_id}:${platform_lead_id}` quando ambos existirem.
  - Fallback: `meta:${platform_form_id}:${email_or_phone_hash}`.
  - Form site: `form:${form_slug_or_name}:${submission_id}` quando existir.
- Antes de chamar qualquer ação comercial, verificar se essa chave já existe em:
  - `platform_lead_id`
  - `raw_payload.previous_platform_lead_ids`
  - `lead_activity_log.entity_id`
  - histórico em `form_data`
- Se já existir: **CDP-only**.

### 4. Desativar rota legada de enrichment para CRM
Em `enrichment-safety-net-cron`:

- Não chamar mais `smart-ops-lia-assign` para `enrichment_only_route_deal` em re-entrega Meta.
- Para itens de Meta/redelivery: marcar como processado com resultado `cdp_only_redelivery_no_crm_touch`.
- Isso impede que fila antiga volte a tentar reativar lead.

### 5. Fail-safe dentro de `executarReativacaoSdrCaptacao`
Mesmo se algum caller antigo ainda chamar a função:

- Antes de criar qualquer novo deal, exigir `new_conversion_confirmed === true`.
- Se não houver prova, abortar antes de Round Robin e antes de `createNewDeal`.
- Manter regra: **não fechar, não mover, não reabrir Estagnados/VENDAS/CS automaticamente**.

### 6. Verificação pós-correção
Depois das alterações:

- Deploy das funções alteradas:
  1. `smart-ops-ingest-lead`
  2. `smart-ops-lia-assign`
  3. `enrichment-safety-net-cron`
- Consultar eventos do lead `drpierregomess@gmail.com` para confirmar que novos reprocessamentos viram `skipped/CDP-only`.
- Confirmar que não existem novos eventos `deal_reativado_via_formulario` após a correção.

## O que não farei sem aprovação explícita

- Não vou fechar automaticamente o deal `#61508533`.
- Não vou mover o deal `#60055732`.
- Não vou apagar notas ou histórico no PipeRun.

A correção é para **parar a automação daqui para frente**; a limpeza do incidente atual deve ser uma decisão manual sua.