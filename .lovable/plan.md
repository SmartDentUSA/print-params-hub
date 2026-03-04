

## Fix: `existingCourses.findIndex is not a function`

### Causa raiz
O campo `astron_courses_access` tem default `'{}'::jsonb` (objeto vazio). O codigo assume que e um array e chama `.findIndex()`, que nao existe em objetos.

### Correcao

**Arquivo**: `supabase/functions/astron-postback/index.ts`, linha 162

Trocar:
```typescript
const existingCourses = (existing?.astron_courses_access as any[]) || [];
```

Por:
```typescript
const raw = existing?.astron_courses_access;
const existingCourses: any[] = Array.isArray(raw) ? raw : [];
```

Isso garante que mesmo que o valor no banco seja `{}`, `null`, ou qualquer nao-array, o codigo usa um array vazio.

### Tambem recomendado
Adicionar suporte aos eventos `newcomment` e `newsupportticket` conforme o plano anterior aprovado, e incluir `fbc`/`fbp` no `useradd` e `change_time` no `usercourseprogresschange`.

Essas melhorias podem ser feitas no mesmo deploy.

