

## Corrigir `astron_courses_completed` para contar cursos 100% do array

### Problema
Linhas 138-144: o contador incrementa `+1` a cada evento com `percentage >= 100`, usando `body.astron_courses_completed` (que nem existe no payload). Resultado: valor incorreto e crescente.

### Correção
**Arquivo**: `supabase/functions/astron-postback/index.ts`

1. **Remover** o bloco de incremento nas linhas 138-144 (dentro do `if (eventType === "usercourseprogresschange")`)

2. **Após o merge do array** (depois da linha 189), calcular `astron_courses_completed` contando quantos cursos no array final tem `percentage >= 100`:

```typescript
// After merging courses into existingCourses array
astronFields.astron_courses_access = existingCourses;
astronFields.astron_courses_total = existingCourses.length;
astronFields.astron_courses_completed = existingCourses.filter(
  (c: any) => Number(c.percentage) >= 100
).length;
```

Isso garante que o valor sempre reflete o estado real do array, independente de quantos eventos chegam.

