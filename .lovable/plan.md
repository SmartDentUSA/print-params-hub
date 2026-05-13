## Diagnóstico

O loop não está vindo da UI. Ele está no backend:

- O mesmo `meta_leadgen_id`/`entity_id` (`2024284941526218`) foi processado 135 vezes em poucas horas.
- A cada reprocessamento, `smart-ops-ingest-lead` dispara `smart-ops-lia-assign` novamente.
- A função deployada ainda contém uma lógica perigosa registrada nos logs como `NOVO HIT... Limpando para novo deal`, que limpa/força novo negócio e faz o `lia-assign` criar outro negócio no PipeRun.
- Quando a reativação `sdr_captacao_reativacao` não encontra deal em Estagnados, ela “continua fluxo normal”, o que permite criar novo negócio repetido.
- As notas `Resumo do Lead` se repetem porque cada novo deal/atualização muda o resumo e dispara nova nota.

## Plano de correção

1. **Adicionar idempotência forte no `smart-ops-ingest-lead`**
   - Para `source = meta_lead_ads`, detectar se `meta_leadgen_id` ou `platform_lead_id` já foi processado para o lead canônico.
   - Se já existir evento `meta_ads_lead_entry` com o mesmo ID, retornar `duplicate_skipped` imediatamente.
   - Não disparar `smart-ops-lia-assign`, `cognitive-lead-analysis`, SellFlux, nota de formulário nem novo evento de timeline nesses duplicados.

2. **Blindar a reativação SDR Captação em `smart-ops-lia-assign`**
   - Se `trigger = sdr_captacao_reativacao` e não houver deal aberto no Funil Estagnados, retornar `skipped: no_estagnado_to_reactivate`.
   - Não continuar para fluxo normal criando novo deal.
   - Preservar a Golden Rule: se já existe deal aberto em Vendas, apenas atualizar/enriquecer, sem trocar owner e sem criar outro negócio.

3. **Remover o comportamento deployado que limpa `piperun_id`**
   - Garantir no código fonte que nenhum reprocessamento de Meta/Form apaga `piperun_id` para “forçar novo deal”.
   - Redeployar `smart-ops-ingest-lead` para substituir a versão deployada que ainda mostra `NOVO HIT... Limpando para novo deal` nos logs.

4. **Deduplicar notas `Resumo do Lead`**
   - Ajustar o hash do `seller-summary` para não mudar por causa de `Atualizado em hoje/agora` quando o conteúdo real é o mesmo.
   - Adicionar janela de segurança: não postar outro `Resumo do Lead` em poucos minutos para o mesmo lead/deal se for reprocessamento.

5. **Deduplicar timeline técnica**
   - Para `lead_activity_log`, evitar inserir novo `meta_ads_lead_entry` quando o mesmo `entity_id` já existe.
   - Isso impede que a tela de histórico pareça “em loop” mesmo quando Meta/SellFlux reentregar o mesmo payload.

6. **Validar em produção**
   - Consultar o lead Heitor após a correção e confirmar que o mesmo `meta_leadgen_id` passa a retornar `duplicate_skipped`.
   - Verificar logs de `smart-ops-ingest-lead` e `smart-ops-lia-assign` para confirmar que não há novo `Negócio criado` nem nova nota para o mesmo evento.

## Arquivos envolvidos

- `supabase/functions/smart-ops-ingest-lead/index.ts`
- `supabase/functions/smart-ops-lia-assign/index.ts`
- `supabase/functions/_shared/seller-summary.ts`
- Possivelmente `supabase/functions/smart-ops-deal-form-note/index.ts` para o mesmo guard de nota duplicada.