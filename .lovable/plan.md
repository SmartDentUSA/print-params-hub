## Seletor absoluto de data/hora nos nós de Wait (WA Campaigns)

Hoje cada nó "Aguardar" só aceita offset relativo (dias + horas + minutos + hora do dia). Vou adicionar um **modo alternativo por nó**: "Data e hora exatos", com um DatePicker + input de hora, sem remover nada do que já existe.

### 1. Modelo do nó

`src/components/smartops/wa-groups/types.ts` — `WaitNode` ganha campos opcionais:
```ts
mode?: "relative" | "absolute";   // default "relative" (retrocompatível)
absolute_at?: string;             // ISO, quando mode === "absolute"
```
Nenhum wait existente é migrado; se `mode` ausente, comporta-se como hoje.

### 2. UI no `WaGroupFlowBuilder.tsx`

Dentro do bloco `n.type === "wait"`:
- Toggle segmentado no topo: **"Relativo"** | **"Data/hora exatos"**.
- Modo Relativo: mostra os 4 inputs atuais (dias, horas, minutos, hora, "só dias úteis") — inalterado.
- Modo Absoluto: mostra um `Popover + Calendar` (shadcn, com `pointer-events-auto`) + input `type="time"`. Um único `absolute_at` é gravado, formatado como "seg, 15/07 às 09:00" no visualizador.
- Validação: se modo absoluto e `absolute_at` vazio/passado → erro no `errors[]` do mesmo pipeline de validação já existente (linhas ~229).

### 3. Backend — `supabase/functions/wa-campaign-builder/index.ts`

Onde hoje calcula `accMs` a partir de days/hours/minutes (linhas 95–124):
- Se `node.mode === "absolute"` e `node.absolute_at` válido:
  - `targetTs = new Date(node.absolute_at).getTime()`
  - `accMs = targetTs - campaignStartTs` (substitui o acúmulo até ali, não soma).
  - Ignora `weekdays_only` e ajustes de hora do dia (o usuário já escolheu o instante exato).
- O bloco de "sub-messages" (envios subsequentes do mesmo nó msg) segue usando o último wait como referência — se o último wait for absolute, herdamos hh:mm dele para o cálculo diário.
- Backward compatível: waits antigos sem `mode` continuam no caminho relative.

### 4. Visualizador

`WaGroupFlowVisualizer.tsx` (se renderizar wait) mostra "⏰ 15/07/2026 09:00" quando absolute, senão o texto atual "em Xd Yh Zm".

### Arquivos afetados
- `src/components/smartops/wa-groups/types.ts` (+2 campos opcionais)
- `src/components/smartops/wa-groups/WaGroupFlowBuilder.tsx` (UI toggle + picker + validação)
- `src/components/smartops/wa-groups/WaGroupFlowVisualizer.tsx` (label absolute)
- `supabase/functions/wa-campaign-builder/index.ts` (ramo absolute no cálculo de `accMs`)

### O que NÃO muda
- Nós `msg`, `ai`, `media`, `link` — intocados.
- Fluxos e campanhas já salvas — continuam funcionando (sem `mode` = comportamento antigo).
- Agendamento global da campanha (`scheduleEnabled/scheduleDate/scheduleTime`) — intocado.
