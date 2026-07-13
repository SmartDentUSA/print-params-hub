## Regra de Ouro — Ganho é Intocável

**Problema observado hoje:** 5 leads com deal marcado "Ganho" hoje voltaram a ter deal aberto no Funil de Vendas e/ou trocaram de vendedor (ex.: Guilherme Soares, Leonardo Joris, Marcelo Kuhnen, Renailda de Lima, EMILEINE ZAMARIOLLI).

**Regra a implementar (invariante do sistema):**

> Se o lead tem **qualquer deal VENDAS ganho nos últimos 30 dias**, ele está **CONGELADO**:
> 1. **Não** pode ser criado novo deal no Funil de Vendas (pipeline 18784) para esse lead.
> 2. **Não** pode ter `proprietario` alterado — o vendedor que ganhou permanece dono do card.
> 3. O único movimento permitido é encaminhamento para **CS Onboarding** (pipeline de pós-venda).

---

### Mudanças em `smart-ops-lia-assign/index.ts`

**1. Guarda universal `assertGoldenRuleWon` (nova função)**
- Executada no topo de todo caminho que possa criar deal ou reatribuir vendedor (`createNewDeal`, `assignSeller`, ramo Estagnados, ramo redelivery Meta, ramo webhook PipeRun).
- Consulta `deals` do lead onde `pipeline_id = 18784` AND `status = 'won'` AND `won_at >= now() - 30 days`.
- Se existir:
  - Bloqueia `createNewDeal` → retorna `{ blocked: 'golden_rule_won_frozen', preservedDealId, preservedOwner }`.
  - Bloqueia mudança de `proprietario` no `lia_attendances` (sanitiza `updateFields` removendo `proprietario`, `owner_id`, `piperun_owner_id`, `equipe`).
  - Permite apenas atualização de campos custom/enrichment e transição para CS Onboarding.

**2. Selar ramo "Estagnados" (linha ~3386)**
- Antes do `createNewDeal` no branch de reativação, chamar `assertGoldenRuleWon`.
- Se bloqueado: **não fecha** o deal Estagnados, registra `system_health_logs` com `event='estagnado_bloqueado_regra_ouro'` e retorna.

**3. Selar redelivery Meta / re-entry por form**
- Em `handleRedeliveryDealRoute` e no fluxo de commercial-intent, aplicar mesma guarda antes de criar deal VENDAS.
- Redelivery só pode criar deal se **não** houver ganho recente; caso contrário, apenas anexa nota ao deal ganho existente.

**4. Sanitizar `updateFields` para proprietário**
- Nova função `stripOwnerFieldsIfFrozen(fields, leadId)`: se lead está congelado pela regra de ouro, remove qualquer chave relacionada a ownership antes do `.update(lia_attendances)`.
- Aplicada em todos os `updatePersonFields`/`updateLeadCard` do arquivo.

**5. Roteamento pós-ganho → CS Onboarding**
- Quando webhook PipeRun reporta `status=won` em pipeline VENDAS, disparar (se ainda não existir) criação de deal em CS Onboarding com **mesmo proprietário** do deal ganho. Nada mais muda no card.

---

### Instrumentação

Novos eventos em `system_health_logs.event_type`:
- `golden_rule_won_frozen_block_create` — tentativa de novo deal VENDAS bloqueada
- `golden_rule_won_frozen_block_owner_change` — tentativa de trocar vendedor bloqueada
- `golden_rule_won_routed_to_onboarding` — encaminhamento correto para CS

Payload: `{ lead_id, piperun_id, preserved_deal_id, preserved_owner, attempted_action, source_branch }`.

---

### Correção retroativa (hoje)

Para os 5 leads divergentes identificados:
- Guilherme Soares (deal 51371591 aberto) → fechar como duplicado, restaurar Lucas Silva
- Leonardo Joris (deal 61792777 com Thiago) → fechar, restaurar Adriano
- EMILEINE ZAMARIOLLI (card com Daniele) → restaurar Janaina
- Marcelo Kuhnen (deal 40774540 com Lucas) → fechar, restaurar Paulo Sérgio
- Renailda de Lima (deal 58482625 com Evandro) → fechar, restaurar Paulo Sérgio

Executado via `supabase--insert` (UPDATE em `lia_attendances` e `deals`) após aprovação.

---

### Memória

Atualizar `mem://architecture/golden-rule-primary-flow` com:
- Ganho VENDAS = estado CONGELADO por 30 dias
- Único destino permitido: CS Onboarding
- `proprietario` imutável enquanto congelado
- Aplicado em todos os ramos: primary, redelivery, estagnados, webhook PipeRun

---

### Arquivos afetados

- `supabase/functions/smart-ops-lia-assign/index.ts` — nova guarda + selagem dos 3 ramos + sanitizador owner
- `supabase/functions/piperun-webhook/index.ts` — roteamento won→onboarding
- `supabase/functions/_shared/commercial-intent.ts` — integração com guarda
- `mem://architecture/golden-rule-primary-flow.md` — atualização de regras
- Dados: correção dos 5 leads de hoje
