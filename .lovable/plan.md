## Diagnóstico

Existem 3 turmas com `whatsapp_group_link` preenchido em `smartops_course_turmas`, mas só **1** tem registro em `wa_groups`. O hook `useTurmaWaGroup` consulta exclusivamente `wa_groups`, então nas outras 2 turmas o botão volta a aparecer com bolinha vermelha e habilitado para criar de novo, mesmo já tendo grupo.

Causas possíveis: link foi colado manualmente no modal, ou a edge function `smartops-create-turma-wagroup` retornou ok mas não escreveu em `wa_groups`. De qualquer forma, a fonte de verdade visível ao usuário é o `whatsapp_group_link` da turma — basta a UI respeitá-lo.

## Correção

### 1. `src/components/smartops/TurmaCard.tsx`
Calcular um `effectiveGroup` que considera ambos os sinais:

```ts
const effectiveGroup = waGroup ?? (turma.whatsapp_group_link
  ? { id: "link-only", nome: null }
  : null);
```

Passar `effectiveGroup` para os dois botões (`CreateTurmaWaGroupButton` e `AddTurmaToWaGroupButton`) no lugar de `waGroup`.

Resultado: se a turma já tem link salvo, o botão fica verde e desabilitado, independente do `wa_groups`.

### 2. `src/components/smartops/CreateTurmaWaGroupButton.tsx`
Após sucesso da edge function, gravar o link na turma para que a persistência fique garantida mesmo se `wa_groups` não tiver sido populado:

```ts
if (r.invite_link) {
  await supabase.from("smartops_course_turmas")
    .update({ whatsapp_group_link: r.invite_link })
    .eq("id", turmaId);
}
await onCreated();
```

(Se a edge function não devolver `invite_link`, esse bloco simplesmente não roda e o comportamento atual fica preservado.)

### 3. Tooltip
Atualizar o texto do tooltip quando o sinal vier só do link:
`"Grupo já vinculado"` em vez de `"Grupo já criado"`.

## Fora de escopo

- Não mexer na edge function `smartops-create-turma-wagroup`.
- Não criar migration nem alterar `wa_groups`.
- Não tocar no fluxo de envio de mensagens / Evolution.