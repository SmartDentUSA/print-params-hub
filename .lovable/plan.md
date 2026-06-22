Dois ajustes independentes:

## 1. Esconder cursos já realizados na Agenda Pública (presencial + online)

`src/pages/AgendaPublica.tsx`
- Hoje o filtro é `!t.end_date || t.end_date >= today`, então cursos que terminaram hoje cedo continuam aparecendo até o fim do dia.
- Substituir por filtro baseado em **datetime real do fim da sessão** (`end_date` + `end_time`, fallback `start_date` + `end_time` ou 23:59):
  - Se `now() > endDateTime` → ocultar.
- Aplicar no `useMemo turmas` e refletir tanto em presencial quanto em online.
- Para cards online agrupados (`onlineCourseGroups`): se todas as sessões do curso já estiverem realizadas, o curso some inteiro do grid.

## 2. Persistência ao editar curso (`CourseCreateModal.tsx`)

Inspecionei `useEffect` que carrega `course` para os states. Identifiquei campos da recorrência que **não são restaurados** ao reabrir um curso em edição:

- `recurrenceSlotsPerSession` — nunca é setado a partir de `course.max_capacity` ao editar; volta sempre para 20.
- (Confirmar) `recurrenceBaseDate` — só é carregado se `recurrence_enabled === true`; caso o curso tenha recorrência mas a primeira turma já não tenha `days`, fica vazio.

Correções:
- Após `setRecurrenceWeekdays(...)`, adicionar `setRecurrenceSlotsPerSession(course.max_capacity || 20)`.
- Garantir que o `useEffect` rode apenas quando o `course.id` mudar (não a cada re-render do pai), trocando dependência para `[course?.id]` para evitar que um refetch do pai reseta o formulário enquanto o usuário ainda digita.
- Não vou alterar `handleSave` — o payload já envia todos os campos corretamente.

**Importante:** Você mencionou "as opções selecionadas não persistem" mas não detalhou quais campos. Se o problema for em campos diferentes dos acima (ex.: produtos relacionados, modalidade, formulário público), me diga quais para eu corrigir especificamente. Mesmo assim, vou aplicar as correções acima já identificadas.

## Fora de escopo
- Editor de Turma, formulário público de inscrição, edge functions.
- Layout dos cards (já ajustado anteriormente).

## Critério de aceite
1. Cursos com data/hora de fim no passado não aparecem mais em `/agenda` nem `/agenda/online`.
2. Ao reabrir um curso recorrente em edição, o campo "Vagas por sessão" exibe o valor salvo (não mais 20 fixo).
3. Editar e salvar um curso não reseta os outros campos enquanto o modal está aberto.