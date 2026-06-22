## Diagnóstico encontrado

- A função `sentinela-webhook-receiver` está recebendo chamadas HTTP 200 recentemente.
- A tabela `sentinela_group_messages` tem apenas 1 registro, que é o teste manual anterior.
- Os 301 grupos ativos estão cadastrados em `wa_groups` com `instance_name = "Danilo Henrique"`.
- A função foi ajustada para `TARGET_INSTANCE = "Danilo-Henrique"`; a comparação normalizada aceita as duas formas, mas a busca do grupo ainda usa o nome recebido literalmente.
- Hoje a função quase não registra motivo de descarte, então não dá para saber se os POSTs reais estão caindo em `not_group`, `from_me`, `non_message_event`, `other_instance` ou payload em formato diferente.

## Plano

1. **Não mexer no que já funciona**
   - Não alterar Evolution/evolutionGo da instância `5519992612348`.
   - Não alterar `team_members`, credenciais, disparos, `wa-dispatcher`, `lia-assign`, webhooks existentes ou a lista dos 301 grupos.

2. **Canonicalizar a instância da Sentinela**
   - Usar `"Danilo Henrique"` como nome canônico interno, porque é assim que `wa_groups` e `team_members` estão cadastrados.
   - Manter aceitação de aliases como `Danilo-Henrique`, `Danilo Henrique`, maiúsculas/minúsculas e variações com espaço/hífen.
   - Salvar mensagens em `sentinela_group_messages.instance_name` como `Danilo Henrique` para casar com os 301 grupos.

3. **Tornar o parser mais tolerante ao payload real da Evolution**
   - Aceitar `body.data`, `body.data.messages`, `body.messages`, `body.message`, `body.key`, `body.remoteJid` e variações comuns de `MESSAGES_UPSERT`.
   - Extrair `remoteJid`, `participant`, `message_id`, `fromMe`, texto, mídia e timestamp mesmo quando vierem em wrappers diferentes.
   - Continuar salvando apenas mensagens de grupo `@g.us` e ignorando mensagens enviadas pela própria conta.

4. **Adicionar diagnóstico controlado**
   - Registrar em `system_health_logs` um resumo seguro quando uma chamada não salvar nada: evento, instância recebida, quantidade de itens e motivos de descarte.
   - Não salvar token, apikey, cabeçalhos sensíveis ou payload completo em logs de erro.
   - Manter o volume baixo para não poluir logs com eventos `ALL` que não são mensagens.

5. **Validar sem impactar produção**
   - Testar a função com um grupo real cadastrado em `wa_groups` e instância `Danilo Henrique`.
   - Testar também com alias `Danilo-Henrique` para garantir compatibilidade com o painel Evolution.
   - Confirmar que `sentinela_group_messages` cresce e que `group_id/group_name` são preenchidos.
   - Conferir logs da função para confirmar ausência de erro.

## Critério de sucesso

- Mensagens reais de grupos da instância Danilo Henrique passam a aparecer em `sentinela_group_messages`.
- O vínculo com os 301 grupos ativos funciona via `group_id` e `group_name`.
- Evolution/evolutionGo existente continua intacto.