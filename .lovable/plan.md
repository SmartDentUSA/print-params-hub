

## Problema Raiz

O campo `nome_completo` no `team_members` estava como **"Celular da Patricia"** no momento do handoff. O código fez `"Celular da Patricia".split(" ")[0]` = `"Celular"`, e a IA gerou a saudação usando "Celular da BLZ Dental" como nome do vendedor.

Você já corrigiu o nome para "Patrica Silva" (visível no screenshot), o que resolve o caso imediato. Mas precisamos prevenir que isso aconteça de novo.

## Plano de Proteção

### 1. Validar `sellerFirstName` antes de enviar ao prompt (dra-lia/index.ts)

Adicionar uma lista de palavras proibidas para primeiro nome (`celular`, `comercial`, `vendedor`, `suporte`, `cs`, `principal`, `teste`). Se o primeiro nome cair nessa lista, usar o nome completo ou pular a apresentação por nome.

```text
// Pseudocódigo
const BLOCKED_NAMES = ["celular","comercial","vendedor","suporte","cs","principal","teste","bot"];
let sellerFirstName = teamMember.nome_completo.split(" ")[0];
if (BLOCKED_NAMES.includes(sellerFirstName.toLowerCase())) {
  // Tenta o segundo nome, senão usa "equipe BLZ Dental"
  sellerFirstName = teamMember.nome_completo.split(" ")[1] || "equipe BLZ Dental";
}
```

### 2. Reforçar o prompt da IA

Adicionar regra explícita no prompt: **"O nome do vendedor é EXATAMENTE: {sellerFirstName}. Não altere, invente ou substitua este nome."**

### Alteração

- **1 arquivo**: `supabase/functions/dra-lia/index.ts` (~linhas 1634-1659)
- Adicionar sanitização do `sellerFirstName`
- Reforçar instrução do nome no prompt

