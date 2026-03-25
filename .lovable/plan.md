

# Plano: Acordeao por tipo de modalidade na aba Agendamentos

## Situacao atual

Os cursos aparecem como cards planos em sequencia. O usuario quer:
1. Agrupar por **tipo de modalidade** (Presencial, Online ao Vivo, etc.)
2. Cada grupo e um **acordeao** (colapsavel)
3. Dentro de cada acordeao, os cards de curso com suas tabelas de turmas permanecem

## Mudanca

**Arquivo: `src/components/SmartOpsCourses.tsx`** — `AgendamentosTab` (linhas 124-249)

### Logica

1. Importar `Accordion, AccordionContent, AccordionItem, AccordionTrigger` de `@/components/ui/accordion`
2. Apos agrupar por `course_id` (ja existente), reagrupar por `modality`:
   ```ts
   const byModality = Object.entries(grouped).reduce((acc, [id, entry]) => {
     const mod = entry.course.modality || 'presencial';
     if (!acc[mod]) acc[mod] = [];
     acc[mod].push({ courseId: id, ...entry });
     return acc;
   }, {});
   ```
3. Renderizar um `Accordion type="multiple" defaultValue={Object.keys(byModality)}` com um `AccordionItem` por modalidade
4. O `AccordionTrigger` exibe o label da modalidade (ex: "Presencial") + badge com contagem de cursos
5. O `AccordionContent` contem os cards de curso existentes (sem alteracao interna)

### Resultado visual

```text
▼ Presencial (1 curso)
  ┌─ Teste [Presencial] ── Danilo Coutigi ─┐
  │ Turma 1 | Encerrado | qua,qui,sex | ...│
  └─────────────────────────────────────────┘

▼ Online ao Vivo (1 curso)
  ┌─ dede [Online ao Vivo] ── dedede ───────┐
  │ dede — 26/03/2026 | 0d 13h 21m | ...   │
  │ dede — 02/04/2026 | 7d 13h 21m | ...   │
  │ ...                                     │
  └─────────────────────────────────────────┘
```

Todos os acordeoes abertos por padrao. Um unico arquivo modificado.

