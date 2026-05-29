## Diagnóstico

O sync retornou `0 grupos` porque a edge function implantada só está descobrindo uma instância no Evolution:

```text
fetchInstances -> [Dra. Lia]
Danilo Henrique não vem na descoberta
```

Mesmo selecionando `Danilo Henrique` na UI via `team_members`, o backend filtra apenas instâncias conectadas vindas de `fetchInstances`; como Danilo não aparece nessa lista, o target fica vazio e nada é sincronizado.

Também há um risco secundário: no frontend, se a função `list_only` retornar só as instâncias da Evolution, ela pode substituir a lista local e esconder instâncias vindas de `team_members`.

## Plano de correção

1. **Manter `team_members` como fonte da verdade para instâncias selecionáveis**
   - Não depender somente de `/instance/fetchInstances`.
   - Se `body.instance_name` vier preenchido e não existir na lista do Evolution, criar um target usando `team_members.evolution_instance_name` + `team_members.evolution_phone`.

2. **Sincronizar Danilo mesmo sem descoberta do Evolution**
   - Para `Danilo Henrique`, chamar diretamente:
     - `/group/fetchAllGroups/Danilo%20Henrique?getParticipants=true`
   - Passar hints por instância:
     - `phone = 5519992612348` vindo de `team_members.evolution_phone`
     - `jid = 5519992612348@s.whatsapp.net` quando o owner da Evolution estiver ausente

3. **Ajustar o filtro de grupos admin**
   - Garantir que `fetchAdminGroups(instanceName, hints)` use `phone`/`jid` da instância selecionada.
   - Preservar fallback legado da Dra. Lia quando nenhum hint for informado.
   - Não alterar `EVO_KEY`, `EVO_BASE`, `sendText`, `sendMedia`, dispatcher ou builder.

4. **Corrigir retorno `list_only` sem quebrar UI**
   - A UI continuará carregando instâncias ativas de `team_members`.
   - O retorno da edge function deve enriquecer status quando houver Evolution, sem eliminar instâncias que só existem no cadastro interno.

5. **Validar**
   - Chamar a edge function com `{ "instance_name": "Danilo Henrique" }`.
   - Conferir resposta `per_instance["Danilo Henrique"].synced > 0` ou erro real da Evolution se o endpoint/nome estiver divergente.
   - Conferir banco:
     - `select count(*) from wa_groups where instance_name='Danilo Henrique'`.

## Arquivos a alterar

- `supabase/functions/wa-sync-groups/index.ts`
- Possivelmente pequeno ajuste em `supabase/functions/_shared/evolution.ts` apenas se necessário para normalizar `jid/phone`.

## O que não muda

- API key global continua igual.
- Base URL do Evolution continua igual.
- Envio de mensagem/mídia não será tocado.
- Dispatcher e flow builder não serão tocados.