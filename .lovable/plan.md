

## Plano: Editar vercel.json e robots.txt

### 1. `vercel.json` — Adicionar 2 rewrites no início do array

Inserir antes da linha 8 (primeiro item do array `rewrites`) duas novas regras:
```json
{
  "source": "/llms.txt",
  "destination": "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/llms-txt"
},
{
  "source": "/.well-known/llms.txt",
  "destination": "https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/llms-txt"
}
```

### 2. `public/robots.txt` — Adicionar bloco ao final

O arquivo já contém as entradas de bots de IA e a diretiva `LLMs: /llms.txt`. O pedido solicita adicionar um bloco adicional com `Anthropic-ai` (minúsculo) e re-declarar os agentes. Vou **append** o bloco exato solicitado ao final sem remover nada existente.

### Arquivos afetados
- `vercel.json`
- `public/robots.txt`

Nenhum componente React, rota ou lógica será alterado.

