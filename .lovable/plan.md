## Problema

Campanhas com `status = 'error'` ficam presas. Ao clicar "Salvar e ativar", o `wa-campaign-builder` rejeita com 400: `"Campanha está error — não pode ser (re)ativada"`.

## Fix (1 linha)

No branch de UPDATE de campanha existente em `WaGroupFlowBuilder.tsx`, adicionar `status: 'draft'` ao payload para resetar o status antes de reativar.

```typescript
// src/components/smartops/wa-groups/WaGroupFlowBuilder.tsx
// Linha ~273: payload.status = "draft"; antes do .update()
```

Aplica tanto em `activate === true` quanto `activate === false` — correto nos dois casos.