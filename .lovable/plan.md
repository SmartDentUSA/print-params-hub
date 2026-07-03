# Plan: Reativação Estagnados → Vendas (Meta + Formulários, com guard de intervenção do vendedor)

## Objetivo
Quando um lead parado no **Funil Estagnados** reage a um **novo anúncio Meta OU a qualquer formulário** (toda a lista `COMMERCIAL_SOURCES`), o sistema deve — **exceto quando o deal Estagnados já teve intervenção manual do vendedor** — fazer o seguinte fluxo:

1. **Fechar** o deal antigo do Estagnados como **"Perdido"**, motivo **"Novo interesse"** (criado dinamicamente no PipeRun se não existir).
2. **Reaproveitar** a mesma Pessoa/Empresa (sem recriar).
3. **Sortear novo vendedor** entre `team_members` ativos (`ativo=true`, `role='vendedor'`) — nunca herda o antigo.
4. **Criar deal novo** em `PIPELINES.VENDAS` / `STAGES_VENDAS.SEM_CONTATO`, com produto/origem/equipamentos via `mapAttendanceToDealCustomFields` + `resolveOriginId`.
5. Registrar `estagnado_fechado_novo_deal_vendas` em `lead_activity_log`.

## Guard: intervenção do vendedor (NOVO)

Se o deal Estagnados **já foi tocado manualmente pelo vendedor** — sinalizando que ele conscientemente qualificou/desqualificou o lead — o patch **NÃO** deve fechá-lo como "Novo interesse". Nesse caso, cai no comportamento legado (`moveDealToVendas`) ou apenas registra e ignora, preservando a decisão humana.

**Sinais de intervenção considerados (OR — qualquer um dispara o guard):**
- `estagnDeal.status === 2` (já Perdido) **E** `lost_reason_id` diferente de "Novo interesse" → vendedor já fechou com motivo próprio; não sobrescrever.
- `estagnDeal.status === 3` (Ganho) ou `4` (cancelado) — não deveria cair nesse branch, mas guarda extra.
- Existência de **anotação/nota manual** no deal feita por um `user_id` que corresponde a um `team_members.piperun_user_id` com `role='vendedor'` (via `GET deals/{id}/notes` ou campo já cacheado em `piperun_staging` se disponível — verificar em exploração).
- `estagnDeal.owner_id` já corresponde a um vendedor ativo **E** `updated_at` do deal é posterior à última atividade automatizada registrada em `lead_activity_log` para esse lead (`event_data.deal_id = estagnDeal.id` com `source_channel != 'form'`).

**Ordem de checagem (barata → cara):** primeiro os campos que já vêm no `estagnDeal` (status, lost_reason_id); só chama `piperunGet notes` se os anteriores não decidirem. Cachear resultado por invocação para evitar múltiplas chamadas.

**Comportamento quando o guard dispara:**
- `flowType = "reactivate_estagnado_seller_intervention_preserved"`.
- **Não** fecha o deal antigo, **não** cria deal novo.
- Registra `lead_activity_log` com `event_type = "estagnado_seller_intervention_skip"` e detalhes do sinal detectado, para auditoria.
- Retorna o `piperunId` antigo (mesmo padrão do branch atual `moveDealToVendas` quanto ao `piperunId` retornado ao lead), sem reatribuir vendedor.

Deals abertos em **Vendas / CS / Onboarding** continuam intocados pelos branches anteriores (`vendaDeal` / golden rule).

## Arquivo alterado
Apenas `supabase/functions/smart-ops-lia-assign/index.ts`.

## Alterações

### 1. Três helpers novas antes de `// ─── Team Member Selection ───`
- `resolveLostReasonId(apiToken)` — busca/cria `"Novo interesse"` em `lostReasons` (`status: false` = ativo). Cache em memória.
- `closeDealAsLost(apiToken, dealId, lostReasonId, reasonComment)` — `PUT deals/{id}` com `status: 2`, `lost_reason_id`, `reason_close`, `closed_at`.
- `hasSellerIntervention(apiToken, supabase, estagnDeal, novoInteresseReasonId)` — retorna `{ intervened: boolean, signal: string }` aplicando a cascata acima (status/lost_reason → notes por vendedor → owner+updated_at vs. activity_log).

### 2. Substituir o branch `else if (estagnDeal && force_new_deal !== true)`

Fluxo:
1. `resolveLostReasonId` (usado tanto pelo guard quanto pelo fechamento).
2. `hasSellerIntervention(...)`. Se `intervened = true`:
   - `flowType = "reactivate_estagnado_seller_intervention_preserved"`.
   - `piperunId = String(estagnDeal.id)`.
   - Log em `lead_activity_log` (`estagnado_seller_intervention_skip`, `event_data.signal`).
   - **Fim do branch**.
3. Caso contrário (fluxo completo):
   - `flowType = "reactivate_estagnado_new_deal"`.
   - `closeDealAsLost(estagnDeal.id, lostReasonId, ...)`.
   - `pickRandomActiveVendedor(supabase)` → sobrescreve `assignedOwnerId/Name/TeamMemberId`.
   - `claimDealCreateSlot(..., 'estagnados_reativacao:{form_name || source}')`; se `lock_held`, aborta com `reactivate_estagnado_new_deal_lock_held`.
   - `createNewDeal(...)` em `PIPELINES.VENDAS` / `SEM_CONTATO`; `releaseDealCreateSlot` no `finally`.
   - Insert em `lead_activity_log` (`estagnado_fechado_novo_deal_vendas`) com IDs antigo/novo, motivo, novo owner, `form_name`, `source`.

## Notas técnicas
- **`status: 2` = Perdido**: validado empiricamente nesta conta (`DEAL_STATUS_MAP`); doc PipeRun cita `3`. **Testar 1 deal manualmente** antes de rodar em produção.
- **Detecção de nota do vendedor**: durante implementação, checar se `piperun_staging` ou algum campo do webhook já traz `notes[].user_id` — evita chamada HTTP extra. Se não trouxer, `piperunGet(deals/{id}/notes)` é aceitável (1 chamada por reativação).
- Sem migração de banco (`lead_activity_log` já aceita os novos `event_type`s).

## Fora de escopo (pendência separada)
Gate `allowCommercialReactivation` / `buildConversionKey` dentro de `smart-ops-ingest-lead` está bloqueando o disparo do `lia-assign` para os 6 leads antigos investigados. Este patch corrige o comportamento **depois** que o lia-assign é chamado; o gate fica para investigação separada.

## Testes pós-deploy
1. Fechar 1 deal Estagnados manualmente via API → confirmar `status: 2` = "Perdido" no PipeRun UI.
2. Simular reengajamento de 1 lead Estagnados via **anúncio Meta** e outro via **formulário do site**: ambos devem fechar o antigo como Perdido/"Novo interesse", criar deal novo em Vendas/Sem contato, com vendedor sorteado ≠ antigo, e gerar row em `lead_activity_log`.
3. Simular reengajamento de 1 lead Estagnados **cujo deal foi manualmente marcado Perdido por outro motivo pelo vendedor** → deve cair no guard, **não** fechar/criar nada, e gerar log `estagnado_seller_intervention_skip`.
