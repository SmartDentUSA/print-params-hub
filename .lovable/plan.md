## Objetivo
Tornar dinâmica a duração no item 2 do comprovante de imersão (`smartops-gerar-comprovante-imersao`), refletindo `duration_days` e `duration_hours_per_day` do curso. Hoje o texto está hardcoded em **"com duração de 3 (três) dias"**.

## Texto atual (item 2)
> A imersão ocorreu na cidade de São Carlos / SP, no período de DD/MM/YYYY a DD/MM/YYYY, **com duração de 3 (três) dias**, e teve como objetivo o treinamento técnico…

## Texto novo (formato)
> …no período de DD/MM/YYYY a DD/MM/YYYY, **com duração de N ({extenso}) {dia|dias}, totalizando H horas**, e teve como objetivo…

Regras:
- Sempre exibir dias com extenso entre parênteses (1 = "um", 2 = "dois", 3 = "três", …, 10 = "dez"; >10 usa só numérico).
- Suprimir o trecho ", totalizando H horas" quando `duration_hours_per_day` for nulo ou 0.
- Quando ambos existirem, calcular total = `duration_days * duration_hours_per_day`.

## Mudanças em `supabase/functions/smartops-gerar-comprovante-imersao/index.ts`

### 1. Buscar curso
Atualizar o SELECT da turma para incluir `course_id`:
```ts
.from("smartops_course_turmas").select("label, launch_date, course_id")
```
Adicionar nova query:
```ts
const { data: course } = await admin
  .from("smartops_courses")
  .select("duration_days, duration_hours_per_day")
  .eq("id", turma.course_id)
  .maybeSingle();
const durationDays = course?.duration_days ?? 3;
const hoursPerDay = course?.duration_hours_per_day ?? null;
const totalHours = hoursPerDay ? durationDays * hoursPerDay : null;
```

### 2. Calcular data fim com base em dias reais
Em `parseTurmaLabel` Case B/C, substituir o fixo `addDaysISO(launchDate, 2)` por `addDaysISO(launchDate, durationDays - 1)`. Passar `durationDays` como parâmetro da função.

### 3. Helpers de extenso
Adicionar utilitário local `numToExtenso(n)` cobrindo 1–10 (fallback retorna string vazia → renderiza só o número).

### 4. Atualizar `buildDocx`
- Adicionar campos `durationDays: number; durationHoursTotal: number | null` à interface de args.
- Substituir o trecho hardcoded por:
```ts
`...no período de ${a.startDD}/${a.startMM}/${a.startYY} a ${a.endDD}/${a.endMM}/${a.endYY}, com duração de ${a.durationDays}${ext ? ` (${ext})` : ""} ${a.durationDays === 1 ? "dia" : "dias"}${a.durationHoursTotal ? `, totalizando ${a.durationHoursTotal} horas` : ""}, e teve como objetivo...`
```

### 5. Passar valores no `buildDocx({...})`
Adicionar `durationDays`, `durationHoursTotal` ao call site.

## Não alterar
- Layout, demais cláusulas, geração do DOCX, função `smartops-gerar-doc-turma`, frontend.

## Validação
- Gerar comprovante para uma turma com `duration_days=3, hours=8` → "duração de 3 (três) dias, totalizando 24 horas".
- Gerar para curso de 1 dia 4h → "duração de 1 (um) dia, totalizando 4 horas".
- Curso sem `duration_hours_per_day` → "duração de N (extenso) dias".

## Arquivos
- **Editado**: `supabase/functions/smartops-gerar-comprovante-imersao/index.ts`
