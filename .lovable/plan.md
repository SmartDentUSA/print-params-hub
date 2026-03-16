

## Problema: busca não inclui `empresa_nome`

A busca atual (linha ~1483) filtra apenas por `nome`, `email` e `telefone_normalized`:

```
query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telefone_normalized.ilike.%${search}%`)
```

O lead "LABORATORIO MERIDIONAL" tem esse valor em `empresa_nome`, mas o campo não está na query de busca.

Na base existem 3 leads relacionados:
- `nome: "Cristian S. Kurtz"` / email: `labmeridional@...`
- `nome: "Laboratório Meridional"` / email: placeholder
- `nome: "Christian Schuh"` / empresa_nome: `LABORATORIO MERIDIONAL`

### Correção

**`src/components/SmartOpsLeadsList.tsx`** — linha ~1483: adicionar `empresa_nome` ao filtro `or`:

```
query.or(`nome.ilike.%${search}%,email.ilike.%${search}%,telefone_normalized.ilike.%${search}%,empresa_nome.ilike.%${search}%`)
```

Mudança de uma linha. Isso permite buscar por nome da empresa além de nome pessoal, email e telefone.

