
## Objetivo

O canvas de "Fluxos Editor" hoje abre vazio porque `operational_flows.graph` está `{}`. O usuário quer ver **exatamente o que está hardcoded** rodando nas edge functions — o canvas passa a ser o espelho fiel do sistema atual (modo `hardcoded`, `active=false`), pronto para servir de baseline antes de qualquer edição futura.

## Escopo

Sem mudar comportamento das edge functions. Apenas:
1. Migração SQL que popula `operational_flows.graph` com os 5 grafos abaixo (nodes + edges + posições).
2. Cria a versão v1 correspondente em `operational_flow_versions` (status `hardcoded_mirror`).
3. Nenhuma mudança no `OperationalFlowEditor.tsx` — ele já sabe renderizar o shape `{nodes,edges}` normalizado.

## Os 5 fluxos espelhados

Cada grafo usa os `nodeType`s já existentes na paleta (`trigger`, `guard`, `enrich`, `merge`, `assign`, `crm_action`, `wait`, `condition`, `notify`, `end`). `config` de cada nó nomeia a edge function / RPC / tabela real, para o usuário ver a origem sem abrir código.

### 1. `ingest_lead` — Ingestão Meta / SellFlux / eCommerce / CSV
```text
trigger(meta-lead-ads-pull, sellflux-webhook, ecommerce-*, csv-import)
  → enrich(flatten raw_field_data + normKey accent-safe)
  → guard(commercial-intent: form_name / source whitelist / piperun_id / override)
  → merge(Smart Merge: piperun_id > email > phone; last-8/11 digits)
  → guard(person-identifier: email OR phone obrigatório)
  → crm_action(createPerson + origin_id frozen)
  → assign(lia-assign primário)
  → end
```

### 2. `assign` — Golden Rule + sorteio de vendedor
```text
trigger(smart-ops-lia-assign)
  → guard(cognitive_lead_locks TTL 30s)
  → condition(deal VENDAS <30d existe?)
       true  → crm_action(update deal existente, preserva owner) → end
       false → guard(commercial-intent) 
             → assign(sorteio round-robin: team_members WHERE ativo AND role='vendedor' AND piperun_owner_id numérico)
             → crm_action(createDeal VENDAS + claimSellerNoteSlot lock)
             → end
```

### 3. `nota` — Resumo do Lead unificado
```text
trigger(deal criado/atualizado)
  → guard(try_claim_seller_note_slot RPC atômica)
  → enrich(mapAttendanceToDealCustomFields + buildPersonFormCustomFields)
  → crm_action(PUT /deals/{id}/custom_fields + PUT /persons/{id}/custom_fields)
  → crm_action(POST /deals/{id}/notes — Resumo do Lead)
  → end
```

### 4. `ltv` — Reativação pós-venda
```text
trigger(deal VENDAS ganho)
  → wait(D+30 / D+60 / D+120 conforme ltv_rules)
  → guard(cooldown + real_status = CLIENTE_ativo)
  → condition(estratégia de vendedor)
       mesmo_dono | round_robin | fixo
  → crm_action(createDeal pipeline LTV, origem = template configurado)
  → notify(WhatsApp opcional)
  → end
```

### 5. `cs_rule` — Régua CS Onboarding / Ganhos Aleatórios
```text
trigger(deal ganho + form_name CS)
  → guard(pipeline protegido: CS Onboarding / Ganhos Aleatórios nunca fecha)
  → enrich(dedupe-redelivery: aplica enrichment universal)
  → crm_action(move stage CS conforme régua)
  → wait(D+n régua)
  → condition(cliente respondeu?) 
       true  → end
       false → notify(WA/SMS via smart-ops-sms-disparopro) → end
```

## Detalhes técnicos

- Migração: `UPDATE public.operational_flows SET graph = $json, rollout_mode='hardcoded', active=false, current_version=1 WHERE flow_key = $key;` para cada uma das 5 chaves.
- Cada `UPDATE` seguido de `INSERT INTO public.operational_flow_versions (flow_id, version, graph, status, note)` com `status='hardcoded_mirror'` e `note='Espelho do comportamento hardcoded em produção — baseline read-only'`.
- Posições `x/y` calculadas em grade (colunas de 220px, linhas de 130px) para o `fitView` do ReactFlow abrir legível.
- `config` de cada nó carrega os nomes reais: `{ "edge_function": "meta-lead-ads-pull" }`, `{ "rpc": "try_claim_seller_note_slot" }`, `{ "table": "cognitive_lead_locks", "ttl_seconds": 30 }`, `{ "memory": "mem://architecture/golden-rule-primary-flow" }` — assim clicar no nó no canvas revela a origem no inspetor JSON.
- Nada é executado a partir do grafo (rollout continua `hardcoded`); o executor real permanece nas edge functions atuais.

## Fora de escopo

- Não altero `smart-ops-lia-assign`, `meta-lead-ads-pull`, `smart-ops-ingest-lead`, nem qualquer outra função.
- Não mudo o `OperationalFlowEditor.tsx` nem a paleta.
- Não ligo `active=true` — quem decidir migrar para execução via grafo faz isso depois, por fluxo, na UI.

## Verificação

Após a migração: abrir `/admin` → aba "Fluxos Editor" → cada um dos 5 fluxos aparece com seu grafo desenhado, badge `v1` `hardcoded`, inativo. Clicar em nós mostra `config` JSON apontando para a edge function / RPC real.
