

## Fix: Polling da Loja Integrada — Erro 400 no `order_by`

### Causa raiz

A API da Loja Integrada (`api.awsli.com.br/v1/pedido/`) **não suporta o parâmetro `order_by`** — nem `-data_modificada`, nem `-modificado`. O endpoint retorna pedidos na ordem padrão da API (por ID/criação). Resultado: erro 400 em todas as execuções do polling desde a última alteração.

Os logs confirmam: `"No matching 'modificado' field for ordering on."` — erro persistente a cada 5 minutos.

### Dados atuais
- **554 eventos** de e-commerce já registrados (31 created, 17 cancelled, 502 invoiced, 4 sellflux)
- Último evento: 18/Mar/2026 — polling parado há 20 dias
- Cursor `li_poll_since` inexistente (nunca foi salvo com sucesso)

### Correção

**Arquivo: `supabase/functions/poll-loja-integrada-orders/index.ts`**

**Linha 137**: Remover `order_by=-modificado` completamente. A API LI não suporta ordenação customizada no endpoint `/pedido/`.

**Linha 138**: Trocar `since_modificado` por `since_atualizado` — parâmetro que a API LI reconhece para filtrar pedidos atualizados após uma data.

```text
ANTES:  /pedido/?limit=${batchSize}&offset=${offset}&order_by=-modificado
        &since_modificado=...

DEPOIS: /pedido/?limit=${batchSize}&offset=${offset}
        &since_atualizado=...
```

**Linha 192**: O campo de timestamp do pedido para o cursor também precisa usar `data_modificacao` (campo real do objeto pedido LI) com fallback para `data_criacao`.

### Escopo
- 1 arquivo alterado, 3 linhas modificadas
- Deploy automático da edge function
- Após deploy, o cron job voltará a funcionar no próximo ciclo (a cada 5 min)

