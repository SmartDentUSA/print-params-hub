## Diagnóstico

- A tela lê `v_wa_group_summary`, que vem de `wa_groups`.
- `wa_groups` tem `298` grupos em `Danilo-Henrique`, mas só 1 foi atualizado hoje — foi o payload de validação.
- O botão **Sincronizar grupos** ainda chama `wa-sync-groups`; para Danilo ele roteia para EvoGo e falha com `fetchAllGroups 404`, porque EvoGo não tem endpoint de listar grupos.
- Não há tráfego real recente chegando no webhook novo `smart-ops-evogo-groups-webhook` além do teste.
- `sentinela_group_messages` tem poucos grupos históricos e aliases misturados (`Danilo Henrique` e `Danilo-Henrique`), então a tela não tem fonte nova suficiente para aparecer atualizada.

## Plano de implementação

1. **Parar o falso sync via endpoint inexistente para EvoGo**
   - Ajustar `wa-sync-groups` para detectar `provider=evolution_go`.
   - Em vez de chamar `/group/fetchAllGroups` e falhar 404, retornar um status claro: `discovery_mode: webhook_observed_groups`.
   - A resposta deve informar quantos grupos já existem em `wa_groups`, o último `synced_at` e quantos foram observados via webhook/mensagens.

2. **Criar refresh real baseado em eventos observados**
   - Adicionar uma função interna/reuso dentro de `wa-sync-groups` para Danilo EvoGo:
     - Ler `sentinela_group_messages` das instâncias `Danilo Henrique` e `Danilo-Henrique`.
     - Normalizar tudo para `Danilo-Henrique`.
     - Criar/atualizar `wa_groups` para cada `group_jid` observado.
     - Usar `group_name` quando existir; senão manter nome existente ou fallback seguro.
   - Isso faz o botão “Sincronizar grupos” atualizar pelo que realmente chegou do EvoGo, sem depender de API inexistente.

3. **Corrigir alias histórico**
   - Aplicar data update para normalizar registros antigos de `sentinela_group_messages.instance_name = 'Danilo Henrique'` para `Danilo-Henrique`.
   - Criar/atualizar em `wa_groups` qualquer grupo observado no Sentinela que ainda não exista.

4. **Melhorar feedback da Central de Campanhas**
   - Na UI, quando a instância selecionada for `Danilo-Henrique`, trocar o texto de sucesso do sync para algo como: “Atualizado por eventos EvoGo observados”.
   - Mostrar uma linha discreta com `último grupo observado/sincronizado`, para não parecer que a lista está congelada quando não há webhook novo chegando.
   - Se o refresh não encontrar eventos novos, exibir aviso: “Nenhum evento novo do EvoGo recebido ainda”.

5. **Validar**
   - Rodar o sync para `Danilo-Henrique`.
   - Confirmar no banco:
     - `wa_groups.instance_name = 'Danilo-Henrique'`
     - `synced_at` atualizado para os grupos observados
     - contagem da view `v_wa_group_summary` refletindo o mesmo total
   - Conferir logs de `wa-sync-groups` sem erro 404 para EvoGo.

## Resultado esperado

O botão da Central passa a atualizar Danilo-Henrique pelo método correto para EvoGo: grupos descobertos por eventos/mensagens recebidos, com alias normalizado e sem erro 404. A UI também passa a deixar claro quando não chegaram eventos novos do EvoGo.