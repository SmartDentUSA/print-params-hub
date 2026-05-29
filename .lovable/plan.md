## Diagnóstico

Há três problemas conectados:

1. **Sync de grupos**
   - `wa-sync-groups` passou a retornar HTTP `202` para indicar processamento em background.
   - O client `supabase.functions.invoke()` está tratando esse retorno como erro e mostra: `Edge Function returned a non-2xx status code`.
   - A correção segura é retornar HTTP `200` com `started: true` no JSON.

2. **Grupos ativos não aparecem**
   - A tela agora filtra por `enabled` e por instância selecionada.
   - Se a sincronização falha/timeout, os dados não atualizam e a lista pode parecer vazia.
   - Também há registros duplicados de instância com o mesmo nome `Danilo Henrique`, o que pode confundir a seleção visual.

3. **Erro ao mudar data/hora de início da automação**
   - Ao salvar e ativar uma campanha já ativa/pausada com nova data, `wa-campaign-builder` só aceita status `draft` ou `paused`.
   - Se a campanha estiver `active`, ele retorna erro 400, que aparece no frontend como `Edge Function returned a non-2xx status code`.

## Plano de correção

1. **Corrigir retorno do sync**
   - Em `supabase/functions/wa-sync-groups/index.ts`, trocar a resposta de background de status `202` para `200`.
   - Manter `started: true`, `targets` e `message` no body.

2. **Não ocultar grupos por falha de sync**
   - Em `SmartOpsWaGroupCampaigns.tsx`, manter a aba `Ativados` como padrão, mas mostrar feedback claro quando não houver grupos no filtro atual.
   - Garantir que o botão de sincronizar não force a lista a parecer vazia enquanto o background ainda roda.
   - Preservar a listagem existente mesmo se o sync retornar erro parcial.

3. **Corrigir ativação/agendamento**
   - Em `supabase/functions/wa-campaign-builder/index.ts`, permitir reconstruir fila quando a campanha estiver `active`, além de `draft` e `paused`.
   - Ao reativar/reagendar, apagar apenas mensagens `pending` da campanha e recriar a fila com o novo `started_at`.
   - Retornar HTTP `200` com `{ ok: false, error }` apenas para erros de validação? Melhor: manter erros reais como 400, mas o frontend passará a exibir `data.error` quando existir.

4. **Melhorar mensagem de erro no frontend**
   - Em `WaGroupFlowBuilder.tsx`, depois de chamar `wa-campaign-builder`, verificar `data?.ok`; se vier falso, mostrar o erro real (`Campanha está active...`, `Campanha sem grupos...`, etc.) em vez da mensagem genérica non-2xx.

5. **Validar**
   - Deploy da `wa-sync-groups` e `wa-campaign-builder`.
   - Testar chamada `wa-sync-groups` para confirmar HTTP 200 imediato.
   - Testar `wa-campaign-builder` em campanha ativa/pausada com `started_at` futuro para confirmar que a fila é recriada sem erro.