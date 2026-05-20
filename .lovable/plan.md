## Escopo

Adicionar um botão "👥 Grupo WA" ao lado do "Gerar Doc" em cada card de turma (`TurmaCard.tsx`), sem alterar mais nada da tela.

## Componente novo

Criar `src/components/smartops/AddTurmaToWaGroupButton.tsx`:

- Props: `turmaId: string`.
- Ao montar, consulta `wa_groups` filtrando por `turma_id` e guarda `{ id, nome }` (se houver).
- Renderiza um `Button` outline pequeno com ícone `Users`:
  - Sem grupo vinculado: botão desabilitado, envolto em `Tooltip` "Nenhum grupo WA vinculado a esta turma".
  - Com grupo vinculado: clicável.
- Loading: troca ícone por `Loader2` (spin) e texto "Adicionando...".

## Ação

Ao clicar, chama `supabase.functions.invoke('smartops-add-turma-to-wagroup', { body: { turma_id } })`.

Resposta esperada (contrato a confirmar):

```text
{ ok: boolean, adicionados?: number, grupo?: string, erros?: number, erros_nomes?: string[], error?: string }
```

Toast com `sonner`:

- `ok: true` e `erros = 0` → `toast.success("✅ {adicionados} participantes adicionados ao grupo '{grupo}'")`.
- `ok: true` com `erros > 0` → `toast.success(...)` + segundo `toast.warning("⚠️ {erros} números com erro: nome1, nome2, …")`.
- `ok: false` → `toast.error(error || "Falha ao adicionar ao grupo")`.

## Integração

Em `src/components/smartops/TurmaCard.tsx`, dentro da `div` do rodapé que já contém o `GerarDocButton`, inserir o novo botão imediatamente após ele:

```tsx
<GerarDocButton turmaId={turma.id} turmaLabel={turma.label} />
<AddTurmaToWaGroupButton turmaId={turma.id} />
```

Nada mais é alterado.

## Pendência (precisa confirmar antes de codar)

A Edge Function `smartops-add-turma-to-wagroup` **não existe** no projeto (`supabase/functions/`). O frontend vai chamar mesmo assim, mas vai falhar até a função existir.

Você quer:

1. Só o botão agora (eu crio a função depois quando você pedir), ou
2. Eu já crio também a edge function `smartops-add-turma-to-wagroup` nesta mesma iteração — nesse caso preciso saber qual provedor WhatsApp usar (Evolution API self-hosted, conforme a Core memory) e em qual instância adicionar membros.