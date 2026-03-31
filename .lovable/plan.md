

# Plano: Explorar API Omie via Edge Function

## Bloqueio atual

Os secrets `OMIE_APP_KEY` e `OMIE_APP_SECRET` **NÃO estão configurados**. A lista atual tem 20 secrets e nenhum é do Omie. Preciso solicitá-los antes de prosseguir.

## Após adicionar os secrets

### Criar Edge Function `omie-api-explorer`

Uma function diagnóstica que chama os principais endpoints Omie e retorna os dados disponíveis.

**Endpoints a consultar:**

| Endpoint | Call | O que retorna |
|----------|------|---------------|
| `/geral/clientes/` | `ListarClientes` | Cadastro de clientes |
| `/geral/clientes/` | `ListarClientesResumido` | Versão resumida |
| `/produtos/pedido/` | `ListarPedidos` | Pedidos de venda |
| `/financas/contareceber/` | `ListarContasReceber` | Parcelas financeiras |
| `/estoque/consulta/` | `ListarPosEstoque` | Posição de estoque |
| `/produtos/requisicaomprod/` | `ListarReqCompra` | Requisições de compra |

Cada endpoint retorna 5 registros de amostra + contagem total + lista de campos disponíveis.

**Comportamento:**
- `GET` sem params → todos os endpoints
- `?only=clientes,pedidos` → endpoints específicos
- Timeout 15s por endpoint, erro graceful

### Arquivos

1. `supabase/functions/omie-api-explorer/index.ts` — function completa
2. `supabase/config.toml` — registrar com `verify_jwt = false`

### Passos

1. Solicitar secrets `OMIE_APP_KEY` e `OMIE_APP_SECRET`
2. Criar a Edge Function
3. Testar via curl e analisar o retorno

