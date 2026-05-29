## Problema

O agendamento de campanhas WhatsApp não respeita `America/Sao_Paulo`. Hoje o código usa `setUTCHours(hh + 3, …)` e `getDay()/getDate()` no runtime do Deno (UTC), o que causa:

- **Offset fixo +3h**: funciona por coincidência (BRT = UTC−3), mas a aritmética é feita em cima de um `Date` cujo dia já está em UTC, então quando `hh + 3 ≥ 24` o agendamento pula para o dia UTC seguinte de forma silenciosa (pode disparar 1 dia depois do esperado em horários ≥ 21:00 BRT).
- **`weekdays_only` quebrado**: `at.getDay()` retorna o dia da semana **em UTC**. Mensagem agendada para sábado 23:00 BRT é sexta-feira em UTC → o guard de fim de semana não dispara.
- **`checkDailyLimit` errado**: `start.setHours(0,0,0,0)` usa meia-noite **UTC**, não meia-noite de São Paulo. O limite diário "vira" às 21:00 BRT, não às 00:00.
- **Inconsistência**: mistura `setUTCHours` com `setDate/getDay` (locais), gerando comportamento imprevisível conforme o horário do dia.

## Solução

Centralizar timezone em um helper compartilhado e usar `America/Sao_Paulo` de forma explícita em todos os pontos de agendamento, sem mais offsets hardcoded.

### 1. Novo helper `supabase/functions/_shared/timezone.ts`

```ts
export const SP_TZ = 'America/Sao_Paulo'

// Retorna o instante UTC correspondente a {dateBase em SP} + horário hh:mm em SP
export function spDateTimeToUtc(base: Date, hh: number, mm: number): Date { … }

// Dia da semana (0=Dom..6=Sáb) considerando o fuso de SP
export function spWeekday(d: Date): number { … }

// Início do dia em SP (em instante UTC) – usado em checkDailyLimit
export function spStartOfDay(d = new Date()): Date { … }

// Avança N dias no calendário SP preservando hh:mm SP
export function addDaysSp(base: Date, days: number): Date { … }
```

Implementação usa `Intl.DateTimeFormat('en-CA', { timeZone: SP_TZ, … })` para extrair partes locais SP e reconstruir o instante UTC, evitando depender do offset fixo (cobre eventual retorno de horário de verão).

### 2. `wa-campaign-builder/index.ts`

- Substituir o bloco `ts.setUTCHours(hh + 3, mm, 0, 0)` por `ts = spDateTimeToUtc(addDaysSp(startBase, accDays), hh, mm)`.
- Substituir `ts.getDay()` por `spWeekday(ts)` no guard `weekdays_only`.
- Avanço de fim de semana via `addDaysSp(ts, 1|2)`, não `setDate`.

### 3. `wa-dispatcher/index.ts`

- Mesmo tratamento no bloco `advanceCampaign` (linhas 274–291).
- `checkDailyLimit`: trocar `start.setHours(0,0,0,0)` por `spStartOfDay()`.

### 4. Validação

- Curl no `wa-dispatcher` após editar uma campanha com node `wait` configurado para 21:30 BRT e `weekdays_only=true` numa sexta — esperado: agendamento cai na **segunda-feira** 21:30 BRT, não no sábado UTC.
- Conferir `next_send_at` retornado pelo `wa-campaign-builder` para horário 09:00 BRT: deve resultar em `12:00:00Z` no mesmo dia SP.
- Verificar `checkDailyLimit` rodando um envio entre 21:00 BRT e 00:00 BRT — a contagem não pode "zerar" às 21:00.

## Não muda

- Schema do banco (`scheduled_at`/`next_send_at` continuam em `timestamptz` UTC).
- Frontend (a UI já trabalha em horário local do navegador).
- Lógica de cooldown / `flow_rebuilt_at` (plano anterior, separado).
