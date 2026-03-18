

# Fix: Restaurar timeline e-commerce com dados reais da API

## Problema

A migration que limpou dados fictícios removeu TUDO do `lojaintegrada_historico_pedidos` (pois nenhum registro legado tinha `situacao_aprovado`). Os dados reais da API ainda não foram sincronizados porque o cron de 3h não rodou ainda. Além disso, o componente `LeadDetailPanel` usa campos do formato antigo (`p.status`, `p.itens`) que não existem no formato real da API (`p.situacao_nome`, sem array de itens).

## Plano

### 1. Disparar sync manual agora

Chamar a Edge Function `sync-loja-integrada-clients` via `curl_edge_functions` para repopular os dados imediatamente com pedidos reais da API.

### 2. Atualizar LeadDetailPanel para formato real da API

Adaptar a tabela de e-commerce (linhas ~932-950) para ler os campos corretos:

| Campo UI | Legado | Real API (novo) |
|----------|--------|-----------------|
| Status | `p.status` | `p.situacao_nome` |
| Data | `p.data` | `p.data_criacao` |
| Valor | `p.valor` | `p.valor_total` |
| Cor status | hardcoded strings | `p.situacao_aprovado` / `p.situacao_cancelado` |

A lógica de status chip passará a usar:
- `situacao_aprovado === true` → verde (s-ganho)
- `situacao_cancelado === true` → vermelho (s-perdido)
- Caso contrário → amarelo (s-aberto) — inclui "aguardando pagamento"

Isso garante que **todos os pedidos** (pagos, cancelados, aguardando pagamento) apareçam corretamente na timeline com data, valor e status.

### 3. Resultado

Todos os pedidos reais da API (aprovados, cancelados, aguardando pagamento) serão exibidos na timeline com os campos corretos.

