

# Plano: Turmas em lista dentro do card + countdown + fix build errors

## Problema

1. Cada turma aparece como um card separado dentro de um grid 3 colunas -- o usuario quer todas as datas como linhas dentro de um unico card por curso
2. Falta: countdown regressivo, numero de contratos, acompanhantes, instrutor, dias da semana, NPS placeholder
3. Build errors em `lia-lead-extraction.ts`, `lia-printer-dialog.ts` (tipos `never` em `agent_sessions`), e `EnrollmentModal.tsx` (campo `instagram` faltando)

## Mudancas

### 1. `src/components/SmartOpsCourses.tsx` — AgendamentosTab (linhas 83-168)

Substituir o grid de cards por uma **tabela** dentro de cada card de curso. Cada turma vira uma linha com:

| Coluna | Conteudo |
|---|---|
| Turma | Label da turma |
| Countdown | `Xd Xh Xm` ate `start_date` (atualizado via `useEffect` + `setInterval` 60s). Se ja passou: "Em andamento" ou "Encerrado" |
| Dias | Dias da semana extraidos das datas (ex: "Qua, Qui, Sex") |
| Contratos | `enrolled_count` (numero de inscritos) |
| Acompanhantes | Query count de `smartops_enrollment_companions` agrupado por `enrollment.turma_id` |
| Instrutor | `course.instructor_name` |
| NPS | Placeholder "—" com tooltip "Em breve" |
| Vagas | Progress bar + `X/Y` |
| Acao | Botao "Agendar" |

Adicionar query de acompanhantes via join:
```sql
SELECT turma_id, count(*) 
FROM smartops_enrollment_companions c
JOIN smartops_course_enrollments e ON c.enrollment_id = e.id
GROUP BY e.turma_id
```

Countdown helper inline:
```ts
function useCountdown(targetDate?: string) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  if (!targetDate) return null;
  const diff = new Date(targetDate + 'T09:00:00').getTime() - now;
  if (diff <= 0) return 'Encerrado';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${d}d ${h}h ${m}m`;
}
```

### 2. `src/components/smartops/EnrollmentModal.tsx` (linha 154)

Adicionar `instagram: ""` ao objeto `setFormData` em `populateFromResult`.

### 3. `supabase/functions/_shared/lia-lead-extraction.ts` (linhas 149-162)

Cast `supabase.from("lia_attendances")` com `as any` nas linhas 141 e 160 para resolver erros de tipo `never`.

### 4. `supabase/functions/_shared/lia-printer-dialog.ts` (linhas 189-211)

Cast `supabase.from("agent_sessions")` com `as any` nas linhas 189, 194, 205 para resolver erros de tipo `never`.

### 5. `src/hooks/useDealSearch.ts`

Ja corrigido (`pais_origem`), sem mudanca necessaria.

## Resultado esperado

Um unico card por curso com header (titulo + modalidade + instrutor) e uma tabela de turmas com countdown regressivo, metricas operacionais e botao de acao por linha.

