Adicionar campo **Minutos** ao nó "Aguardar" do construtor de fluxo de grupos, ao lado de Dias e Horas.

## Mudanças

**1. `src/components/smartops/wa-groups/types.ts`**
- Adicionar `minutes?: number` em `WaitNode`.

**2. `src/components/smartops/wa-groups/WaGroupFlowBuilder.tsx`**
- Adicionar input "Minutos" (0–59) ao lado de Dias e Horas no editor do nó wait.
- Desabilitar o input de "Horário" quando `hours > 0` OU `minutes > 0` (offset relativo).
- Atualizar validação para aceitar minutos.

**3. `supabase/functions/wa-campaign-builder/index.ts`**
- Ler `minutes` do nó wait e somar ao `accMs`:
  ```ts
  accMs += days * 86_400_000 + hours * 3_600_000 + minutes * 60_000
  ```
- Considerar offset relativo (ignorar horário do dia) quando `hours > 0 || minutes > 0`. Apenas dias puros continuam ancorando no horário SP.

Nenhuma mudança em banco ou em outros componentes.
