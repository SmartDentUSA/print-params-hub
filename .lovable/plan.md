## Diagnóstico confirmado

A tentativa das 18:22 encontrou **184 leads**, criou a campanha `bfe73270-bab7-4753-b16e-733c08369670`, mas falhou ao inserir os destinatários:

```text
campaign_send_log.campaign_id → campaign_sessions.id
```

O fluxo novo grava o ID de `campaigns`, não de `campaign_sessions`. O banco rejeita todas as linhas com erro `23503`, deixando a campanha como “scheduled”, porém com fila vazia. Há também outra campanha de 2 leads no mesmo estado.

## Implementação

1. **Corrigir o modelo sem quebrar SMS/WhatsApp**
   - Preservar `campaign_send_log.campaign_id` para os fluxos antigos ligados a `campaign_sessions`.
   - Adicionar uma referência separada para a campanha unificada em `campaigns`.
   - Permitir que registros de e-mail usem essa nova referência sem exigir uma sessão legada.

2. **Atualizar todo o pipeline de e-mail**
   - `smart-ops-send-gmail`: gravar e consultar a nova referência da campanha.
   - `smart-ops-email-scheduler-tick`: localizar filas pelo novo vínculo, enviar em rodízio e concluir a campanha corretamente.
   - Manter abertura, clique, limite diário e janela 07:30–19:00 funcionando.

3. **Eliminar o sucesso falso na interface**
   - Validar `data.ok` e `campaign_id` antes de mostrar “campanha enfileirada”.
   - Exibir a mensagem detalhada devolvida pela função quando a criação da fila falhar.

4. **Recuperar as campanhas afetadas**
   - Recriar somente as filas ausentes das campanhas já registradas (184 e 2 destinatários), sem duplicar a campanha.
   - Disparar o scheduler e confirmar que os registros mudam de `queued` para `sent`/`failed` e aparecem no histórico.

5. **Validação final**
   - Testar diretamente as duas Edge Functions.
   - Conferir banco e logs: total enfileirado, primeiro envio pelo Gmail, contadores e ausência dos erros `23503`.