## Plano

1. **Corrigir a descoberta da instância Danilo Henrique**
   - Manter `team_members.evolution_instance_name = 'Danilo Henrique'` como fonte interna para a instância, mesmo quando ela não aparece em `/instance/fetchInstances`.
   - Usar `5519992612348` e `5519992612348@s.whatsapp.net` como hints oficiais dessa instância.
   - Não alterar `EVO_BASE`, envio de mensagens, dispatcher ou builder.

2. **Ajustar o filtro de grupos em `fetchAdminGroups`**
   - Hoje o log mostra que a função chamou Danilo com os hints corretos, mas retornou `0 grupos admin`; isso indica que o endpoint respondeu, porém o filtro local descartou tudo.
   - Tornar o filtro tolerante aos formatos reais do Evolution:
     - aceitar `owner` / `subjectOwner` por telefone/JID;
     - aceitar participante admin quando o ID bate por JID, LID ou telefone;
     - normalizar variações de `admin` (`admin`, `superadmin`, `true`, etc.);
     - para instância selecionada explicitamente, se o Evolution já retorna os grupos daquele celular mas não expõe LID/owner compatível, sincronizar os grupos retornados com `is_admin` derivado quando possível, em vez de descartar tudo.

3. **Melhorar diagnóstico no retorno e logs da edge function**
   - Logar por instância:
     - quantidade bruta de grupos recebidos do Evolution;
     - quantidade após filtro;
     - se houve fallback por ausência de match de owner/LID.
   - Retornar `per_instance['Danilo Henrique']` com `raw`, `synced`, `groups` e `warning` quando aplicável.

4. **Corrigir escopo do `team_members` para não depender do nome do vendedor ativo**
   - O banco tem vários vendedores ativos usando a mesma instância `Danilo Henrique`, enquanto o registro com nome `Danilo Henrique` está inativo.
   - A sincronização deve tratar a instância como entidade WhatsApp, não como vendedor individual ativo, usando `distinct evolution_instance_name` + telefone/token disponível.

5. **Validar após implementar**
   - Chamar `wa-sync-groups` com `{ "instance_name": "Danilo Henrique" }`.
   - Confirmar nos logs algo como:
     ```text
     [wa-sync-groups] Danilo Henrique: X grupos recebidos, Y sincronizados
     ```
   - Conferir no banco:
     ```sql
     select count(*) from wa_groups where instance_name = 'Danilo Henrique';
     ```

## Arquivos previstos

- `supabase/functions/_shared/evolution.ts`
- `supabase/functions/wa-sync-groups/index.ts`

## Fora de escopo

- Não mexer em `sendText` / `sendMedia`.
- Não mexer no dispatcher.
- Não mexer no flow builder.
- Não mudar servidor/base URL do Evolution.