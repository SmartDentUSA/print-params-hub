

## Resolver cliente via API quando pedido tem apenas resource_uri do cliente

### Problema
A Loja Integrada retorna o campo `cliente` como string URI (ex: `/api/v1/cliente/12345`) em vez de objeto com email inline. O webhook atual tenta extrair `customer.email` de um objeto, mas recebe uma string, resultando em "Pedido sem email, ignorando".

### Solucao

Adicionar uma funcao `fetchClienteFromLI` e usá-la entre as linhas 244-258 do webhook, antes da checagem de email.

**1. Nova funcao `fetchClienteFromLI`** (ao lado de `fetchOrderFromLI`):
- Recebe clienteUri (string), apiKey, appKey
- Extrai o ID do cliente via regex: `/cliente/(\d+)/`
- Faz GET para `https://api.awsli.com.br/api/v1/cliente/{id}/?chave_api=...&chave_aplicacao=...`
- Lê resposta com `response.text()` + `JSON.parse()` em try/catch
- Retorna objeto cliente ou null

**2. Logica de resolucao** (inserida entre linhas 244-249):
- Apos extrair `customer` do order, verificar se `order.cliente` é string começando com `/api/` ou `/cliente/`
- Se sim E não há email no customer object, chamar `fetchClienteFromLI`
- Mesclar dados do cliente resolvido (email, nome, telefone, cpf, etc.) no objeto `customer`
- Prosseguir normalmente com o fluxo existente

**3. Nenhuma outra mudanca** - o resto do fluxo (tags, upsert, log) permanece identico.

### Detalhes tecnicos

```text
Fluxo atual:
  order.cliente = "/api/v1/cliente/123" (string)
  customer = {} (cast falha silenciosamente)
  email = "" → "Pedido sem email, ignorando"

Fluxo corrigido:
  order.cliente = "/api/v1/cliente/123" (string)
  → detecta URI, extrai ID 123
  → GET /api/v1/cliente/123/?chave_api=...
  → { email: "x@y.com", nome: "...", cpf: "..." }
  → customer mergeado com dados resolvidos
  → email = "x@y.com" → processamento normal
```

Apos editar, deploy via `deploy_edge_functions`.

