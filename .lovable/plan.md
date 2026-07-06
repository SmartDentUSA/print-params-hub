## Problema

O dialog "Adicionar/Editar Membro" em `SmartOpsTeam.tsx` cresceu (agora tem ManyChat, WaLeads, Evolution completo + Evolution GO) e não cabe na viewport. O `DialogContent` padrão do shadcn não tem scroll interno, então a seção "Configurações Evolution GO" fica cortada e o botão "Salvar" some.

## Correção (só CSS)

Arquivo único: `src/components/SmartOpsTeam.tsx`

1. No `<DialogContent>` do dialog de membro, adicionar `className="max-h-[90vh] overflow-y-auto"` para permitir scroll interno.
2. Adicionar `DialogDescription` (via import) com texto curto de acessibilidade — resolve o warning "Missing Description" que já aparece no console.

Nenhuma outra mudança (nada de lógica, campos, RLS, edge functions, migrations).
