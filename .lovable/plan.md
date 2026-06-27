## Problema confirmado

Ainda existe um caminho que força criação/reabertura de Deal: em `smart-ops-ingest-lead`, quando encontra lead existente vindo de fonte comercial e o snapshot local não diz “Funil de vendas”, o código zera `piperun_id`, `piperun_link` e `proprietario_lead_crm`. Isso deixa o `smart-ops-lia-assign` sem cache local e permite criar nova oportunidade em “Sem contato”.

No exemplo da Jennifer, a nota de “nome veio como razão social” só é postada quando `flowType === "new_deal"`, então o fluxo realmente passou por criação nova, apesar de já haver 5 deals abertos no histórico.

## Alteração cirúrgica proposta

1. Em `supabase/functions/smart-ops-ingest-lead/index.ts`:
   - Remover/desativar o bloco `shouldForceNewDeal` que zera `piperun_id` para leads existentes.
   - Manter apenas merge/enriquecimento CDP; ingestão não decide mais “novo deal”.
   - Retornar `forced_new_deal: false`.

2. Em `supabase/functions/smart-ops-lia-assign/index.ts`:
   - Fortalecer `findPersonDealsWithStatus` com fallback de busca direta por `reference=email`, `search=email` e `search=telefone` quando a busca por `person_id` vier vazia, pois o PipeRun pode ter múltiplas Persons ou retornar lista incompleta.
   - Criar helper local para preservar Deal de VENDAS a partir de `piperun_deals_history` quando a API falhar ou vier vazia. Se houver qualquer deal VENDAS aberto no histórico local, ou VENDAS recente, bloquear `createNewDeal`.
   - No fluxo principal, antes de qualquer `createNewDeal`, aplicar a guarda combinada: PipeRun API + histórico local. Se houver VENDAS aberto, apenas preservar/logar internamente, sem mover stage, sem reabrir, sem nota.
   - Remover a reativação automática de `Estagnados → Vendas` no fluxo normal; se existir Estagnados mas não houver VENDAS, preservar sem mover, pois a regra atual é “não reabrir sem nova interação real”.
   - Remover bypass de `force_new_deal` da regra de ouro para VENDAS. Mesmo Loja Integrada/formulário não cria novo Deal se já existir VENDAS aberto.

3. Em `supabase/migrations/`:
   - Ajustar a trava `smartops_golden_rule_deal_locks` para ter chave única por `person_id` além de `lead_id`, evitando corrida quando duas linhas CDP diferentes apontam para a mesma Pessoa PipeRun.

## Resultado esperado

- Nenhum lead volta para “Sem contato” se já existir Deal aberto em VENDAS.
- Nenhum caminho de ingestão zera `piperun_id` para provocar criação nova.
- Reentrega Meta/formulário só enriquece dados e registra log interno quando necessário.
- Sem notas adicionais de reabertura/preservação no PipeRun.