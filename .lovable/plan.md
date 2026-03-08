

# Mostrar Todos os Campos Numerados no Card de Leads (Mesmo Vazios)

## Problema
O `FieldGrid` atual filtra campos null/vazios, ocultando-os. O usuário precisa ver **todos** os campos sempre visíveis e **numerados** para poder mapear cada campo com formulários.

## Alteração

**Ficheiro**: `src/components/SmartOpsAudienceBuilder.tsx`

1. **Remover o `.filter()` do `FieldGrid`** que oculta campos vazios
2. **Adicionar numeração global contínua** — cada campo recebe um índice sequencial (`#1`, `#2`, `#3`...) que persiste entre seções, usando um `startIndex` prop
3. **Campos vazios** mostram "—" em cinza claro para distinguir de campos preenchidos
4. **Cada seção do Accordion** passa o `startIndex` correto baseado na soma dos campos das seções anteriores

### Resultado visual por campo:
```text
┌─────────────────────────┐
│ #1 · nome               │
│ João Silva              │
├─────────────────────────┤
│ #2 · email              │
│ joao@email.com          │
├─────────────────────────┤
│ #3 · telefone_normalized│
│ —                       │  ← campo vazio, visível
└─────────────────────────┘
```

### Detalhes técnicos
- `FieldGrid` ganha prop `startIndex: number` (default 0)
- Cada card mostra `#{startIndex + i + 1}` antes do nome do campo
- Remove a linha `.filter(...)` e o early return "Nenhum dado"
- Campos vazios renderizam `<span className="text-muted-foreground italic">—</span>`
- Nas 15 seções do Accordion, calcula-se o offset acumulado para manter numeração contínua

