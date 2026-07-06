## Diagnóstico
No banco, o Danilo Henrique **tem** `evo_go_instance_id`, `evo_go_instance_token` e `evo_go_base_url` preenchidos, mas o badge mostra **Desconectado** porque:

1. A função `smart-ops-evogo-status` que criei consulta `GET ${base}/instance/fetchInstances` — esse é endpoint do Evolution API clássico, **não do EvoGo**. Vale para :8080 (Evolution API), mas :8081 (EvoGo) responde 404 → `state=close`.
2. Além disso, o `evolution_base_url` dele está incorretamente cadastrado como `:8081` (deveria ser `:8080`), então o badge do Evolution também fica errado.

Você confirmou a regra: **Evolution = `http://82.25.75.61:8080`**, **EvoGo = `http://82.25.75.61:8081`**.

## Alterações

### 1. `supabase/functions/smart-ops-evogo-status/index.ts`
Trocar o endpoint checado por um que o EvoGo suporta de verdade:
- Usar `GET ${base}/instance/connectionState/${instance_id}` com header `apikey: evo_go_instance_token` (padrão Evolution que o EvoGo espelha).
- Fallback: se 404, tentar `GET ${base}/instance/status` e depois `GET ${base}/` para pelo menos detectar se o servidor está de pé.
- Parse: considera `open` quando o corpo trouxer `state === "open"` ou HTTP 200 no `connectionState`; senão `close`.
- Default do `base`: `http://82.25.75.61:8081` quando a coluna estiver vazia.
- Identificador da instância: usa `evo_go_instance_id` se presente, senão `evolution_instance_name`.

### 2. `src/components/SmartOpsTeam.tsx` — Defaults e placeholders
- Placeholder do campo "Base URL" na seção **Evolution**: `http://82.25.75.61:8080`.
- Placeholder do campo "Base URL" na seção **Evolution GO**: `http://82.25.75.61:8081`.
- No `handleSubmit`, se o usuário deixar em branco, preencher automaticamente:
  - `evolution_base_url` → `http://82.25.75.61:8080`
  - `evo_go_base_url` → `http://82.25.75.61:8081`

### 3. Correção pontual do registro do Danilo (SQL)
Migration one-shot para consertar apenas esse membro:
```sql
UPDATE public.team_members
SET evolution_base_url = 'http://82.25.75.61:8080'
WHERE id = '39657ed1-3151-4f45-b8a2-ca4b9eb6e932'
  AND evolution_base_url = 'http://82.25.75.61:8081';
```
Não toca nas credenciais nem no `evo_go_base_url` (que já está correto).

## O que NÃO muda
- Nada em `wa-dispatcher`, `smart-ops-integration-check`, RLS, outras colunas ou lógica de envio.
- Nenhum outro membro é alterado no update.

## Pergunta rápida
Se você souber o endpoint oficial de status do EvoGo (ex.: `/instance/connectionState/{id}` ou outro), me confirma que eu uso direto sem fallbacks. Caso contrário sigo com a cascata acima.
