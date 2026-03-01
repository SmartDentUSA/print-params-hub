

## Adicionar campos `lojaintegrada_*` na `lia_attendances`

### Objetivo
Criar campos dedicados com prefixo `lojaintegrada_` para armazenar dados vindos exclusivamente da Loja Integrada, permitindo filtrar e identificar a origem das informações.

### Novos campos na tabela `lia_attendances`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `lojaintegrada_cliente_id` | integer | ID do cliente na LI (`cliente.id`) |
| `lojaintegrada_cliente_obs` | text | Observação do cliente |
| `lojaintegrada_cupom_desconto` | text | Cupom usado no pedido |
| `lojaintegrada_data_nascimento` | date | Data de nascimento |
| `lojaintegrada_sexo` | text | Sexo do cliente |
| `lojaintegrada_endereco` | text | Endereço completo |
| `lojaintegrada_numero` | text | Número do endereço |
| `lojaintegrada_complemento` | text | Complemento |
| `lojaintegrada_bairro` | text | Bairro |
| `lojaintegrada_cep` | text | CEP |
| `lojaintegrada_referencia` | text | Referência do endereço |
| `lojaintegrada_ultimo_pedido_numero` | integer | Número do último pedido |
| `lojaintegrada_ultimo_pedido_data` | timestamptz | Data do último pedido |
| `lojaintegrada_ultimo_pedido_valor` | numeric | Valor total do último pedido |
| `lojaintegrada_ultimo_pedido_status` | text | Status/situação do último pedido |
| `lojaintegrada_forma_pagamento` | text | Forma de pagamento usada |
| `lojaintegrada_forma_envio` | text | Forma de envio (PAC, Sedex, etc.) |
| `lojaintegrada_itens_json` | jsonb | Array completo dos itens do pedido |
| `lojaintegrada_utm_campaign` | text | UTM campaign do pedido |
| `lojaintegrada_updated_at` | timestamptz | Última atualização vinda da LI |

### Alterações

1. **Migration SQL** — Adicionar os ~20 campos acima na `lia_attendances`
2. **Edge Function `smart-ops-ecommerce-webhook/index.ts`** — Extrair todos esses campos do payload e incluí-los no insert/update do lead

