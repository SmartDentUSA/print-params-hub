## Esconder contador "Pergunta X de Y · NN%" no formulário público

No arquivo `src/pages/PublicFormPage.tsx`, linhas 505-509 atualmente renderizam:

```tsx
<div className="flex justify-between text-xs ...">
  <span>Pergunta {safeStep+1} de {totalSteps}</span>
  <span>{Math.round(...)}%</span>
</div>
<div className="h-2 ..."> <div style={{ width: ... }} /> </div>
```

### Mudança
Remover o bloco `<div>` com os dois `<span>` (linhas ~506-509), mantendo apenas a barra colorida (linhas 510-514). O lead deixa de saber quantas perguntas faltam, evitando desistência.

### Arquivo
- `src/pages/PublicFormPage.tsx` — única alteração.

Sem impacto em lógica de avanço, validação ou estado.
