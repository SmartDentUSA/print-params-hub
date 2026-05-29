## Diagnóstico

A campanha "Nova campanha" (id `73fdbb9f...`) foi salva com `started_at = 2026-05-29 14:56 UTC` (11:56 BRT, próximo dos 11:57 pedidos), mas a fila gerou `scheduled_at = 2026-05-30 12:00 UTC` — ou seja, foi empurrada para o dia seguinte às 09:00 BRT. Por isso o dispatcher não disparou no horário.

A causa está em `supabase/functions/wa-campaign-builder/index.ts`, no loop que monta `queueRows`:

```ts
const time = (lastWait?.time as string) ?? '09:00'
const [hh, mm] = time.split(':').map(Number)
const ts = new Date(startTs + accMs)
ts.setUTCHours(hh + 3, mm, 0, 0)
if (ts.getTime() < Date.now() && accMs === 0) ts.setDate(ts.getDate() + 1)
```

Para o primeiro nó (sem nó `wait` antes), `lastWait` é null → o horário é forçado para `09:00 BRT`, ignorando o `started_at` escolhido. Como `09:00` de hoje já passou, o `if` empurra para o dia seguinte → `30/05 12:00 UTC`.

Ou seja: o horário escolhido na UI (`started_at`) só é usado como "data base"; o horário real é sempre 09:00 BRT (ou o `time` do último `wait`).

## Plano de correção

1. **`supabase/functions/wa-campaign-builder/index.ts`** — ajustar o cálculo de `ts`:
   - Se ainda não passamos por nenhum `wait` (`lastWait === null` e `accMs === 0`): usar `ts = new Date(startTs)` diretamente, sem sobrescrever hora/minuto. Assim respeita o `started_at` exato vindo da UI.
   - Se já houve `wait`: manter a lógica atual (`ts.setUTCHours(hh + 3, mm, 0, 0)` baseada no `wait.time`).
   - Manter o ajuste de dias úteis (`weekdays_only`) apenas quando há `wait`.
   - Remover/ajustar o `if (ts < Date.now() && accMs === 0) ts.setDate(+1)` para o primeiro nó: se `started_at` for futuro, não mexer; se for passado por pouco (ex.: alguns minutos), disparar imediatamente (mantém `ts`).

2. **Reativar a campanha existente** — após corrigir, o usuário pode salvar/ativar novamente em `73fdbb9f...` (o builder já aceita status `active`, conforme correção anterior), o que apaga `pending` e recria a fila com `scheduled_at` correto.

3. **Validação**
   - Deploy de `wa-campaign-builder`.
   - Reativar a campanha de teste com `started_at` ~2 min no futuro.
   - Conferir via SQL: `SELECT scheduled_at FROM wa_message_queue WHERE campaign_id=...` — deve bater com o `started_at` escolhido.
   - Conferir log do `wa-dispatcher` no horário marcado.

## Arquivos
- `supabase/functions/wa-campaign-builder/index.ts` (lógica de agendamento do 1º nó)

Nenhuma mudança de UI ou de schema.
