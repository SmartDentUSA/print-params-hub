## Mostrar telefone em todos os cards do Kanban

**Arquivo**: `src/components/smartops/KanbanLeadCard.tsx`

Adicionar uma linha logo abaixo do email (linha 130) exibindo `lead.telefone_normalized` quando presente, com o mesmo padrão visual das outras linhas (`text-[10px] text-muted-foreground truncate`) e emoji 📱.

```tsx
{lead.telefone_normalized && (
  <div className="text-[10px] text-muted-foreground truncate">
    📱 {lead.telefone_normalized}
  </div>
)}
```

Sem mudanças em backend, schema, ou no header de detalhe (já mostra). Apenas frontend, presentation.
