## Alterar rota inicial

### Arquivo alvo
- `src/App.tsx`

### Alteracao
Substituir a rota `/` para redirecionar automaticamente para `/base-conhecimento?tab=parametros`.

**Trecho atual (linha ~99):**
```tsx
<Route path="/" element={<Index />} />
```

**Trecho novo:**
```tsx
<Route path="/" element={<Navigate to="/base-conhecimento?tab=parametros" replace />} />
```

### Observacoes
- `Navigate` ja esta importado em `src/App.tsx` (`import { ..., Navigate } from "react-router-dom"`).
- Nenhuma outra alteracao sera feita.
- `Index` deixa de ser usado como rota inicial, mas continua importado no arquivo por precaucao (sem remocao de import para evitar quebra de build caso seja referenciado em outro lugar).