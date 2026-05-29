## Objetivo
Corrigir o sync de grupos para que os grupos da instância `Danilo Henrique` sejam salvos como admin quando o Danilo é administrador, sem mexer em envio, dispatcher, builder, `EVO_BASE` ou `EVO_KEY`.

## Diagnóstico confirmado
- `wa_groups` tem 402 grupos para `Danilo Henrique`, todos com `is_admin=false`.
- A instância está cadastrada em `team_members` com telefone `5519992612348` e API key própria.
- O banco ainda não tem coluna `evolution_lid`.
- O log mostra que a função só usa `5519992612348@s.whatsapp.net`/telefone como hint, mas a Evolution retorna o admin/owner em formato `@lid`; por isso a comparação nunca bate.

## Plano de implementação
1. **Persistir LID da instância**
   - Criar a coluna nullable `team_members.evolution_lid`.
   - Não criar tabela nova; sem alteração de RLS necessária.

2. **Descobrir automaticamente o LID do Danilo**
   - Em `wa-sync-groups`, após buscar os 402 grupos, contar participantes com `admin`/`superadmin` cujo `id` termina em `@lid`.
   - Selecionar o LID mais frequente como provável LID da instância, usando uma trava mínima de confiança para evitar falso positivo.

3. **Recalcular `is_admin` no mesmo sync**
   - Após descobrir o LID, recalcular todos os grupos já baixados: grupo será admin quando `owner`, `subjectOwner` ou participante admin bater com esse LID.
   - Persistir os grupos com `is_admin=true` quando aplicável.

4. **Salvar o LID para próximos syncs**
   - Atualizar todos os registros de `team_members` com `evolution_instance_name = 'Danilo Henrique'` e telefone `5519992612348` para guardar o LID descoberto.
   - Em syncs futuros, ler `evolution_lid` e passar como hint direto.

5. **Logs e validação**
   - Logar: grupos brutos, candidatos LID, LID escolhido, quantidade admin recalculada.
   - Validar chamando `wa-sync-groups` com `{ "instance_name": "Danilo Henrique" }`.
   - Conferir no banco: `count(*) filter (where is_admin)` para `instance_name='Danilo Henrique'` deve ficar maior que zero.

## Fora do escopo
- Não alterar `sendText`/`sendMedia`.
- Não alterar dispatcher nem builder.
- Não alterar servidor Evolution, `EVO_BASE` ou chave global.