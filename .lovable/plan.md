## Diagnóstico

O loop vem do nosso `smart-ops-lia-assign`: em atualizações de oportunidade existente ele está enviando `origin_id` novamente para o PipeRun com base no `form_name` atual. Quando outro sync/webhook lê a origem real do PipeRun de volta, os dois lados passam a alternar a origem entre `BLZ- Smart Dent` e `# - FACE - BLZ INO110 PLUS + NOTEBOOK`.

Regra correta: origem de oportunidade existente deve ser preservada. Origem só deve ser definida na criação de uma nova oportunidade.

## Plano de correção

1. **Congelar origem em oportunidades existentes**
   - Remover `origin_id` do payload de `updateExistingDeal` em `supabase/functions/smart-ops-lia-assign/index.ts`.
   - Assim, enriquecimentos, redeliveries Meta e atualizações de campos continuam funcionando, mas não mexem mais na origem do negócio.

2. **Evitar troca de origem em reativação/movimentação**
   - Remover `origin_id` do payload de `moveDealToVendas` quando a oportunidade já existe e apenas muda de funil/etapa.
   - Preservar `origin_id` apenas em `createNewDeal`, pois nesse caso a oportunidade é nova.

3. **Limpar enriquecimento pós-criação**
   - Em `createNewDeal`, manter `origin_id` no payload inicial de criação.
   - Remover `origin_id` do segundo PUT de enriquecimento pós-criação, para evitar uma segunda alteração desnecessária na timeline do PipeRun.

4. **Neutralizar helper legado compartilhado**
   - Ajustar `supabase/functions/_shared/piperun-hierarchy.ts` para não enviar `origin_id` em updates/moves de negócios existentes, mantendo apenas em criação.
   - Isso impede regressão se algum fluxo voltar a usar esse helper.

5. **Adicionar auditoria/log preventivo**
   - Adicionar log explícito indicando `origin=PRESERVED` em updates de oportunidades existentes.
   - Facilita validar nos logs que o sistema parou de enviar `origin_id`.

6. **Deploy e validação**
   - Deploy da Edge Function `smart-ops-lia-assign`.
   - Checar logs recentes buscando `origin_id`; o esperado é aparecer somente em criação de novo deal, não em `Updating deal`.

## Resultado esperado

A timeline do PipeRun deixa de registrar alterações repetidas de origem. O sistema ainda atualiza vendedor, empresa, etapa, campos customizados e notas, mas a origem histórica da oportunidade fica estável.