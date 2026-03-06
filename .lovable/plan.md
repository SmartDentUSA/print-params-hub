

# Kanban Nao Atualiza — Diagnostico e Correcao

## Causa Raiz

O Kanban carrega **todas as abas de uma vez** com `.limit(2000)`, mas existem **24.502 leads** distribuidos nos status do Kanban. So a aba "Estagnados" tem **19.825 leads** (est_etapa1 = 16.627 sozinha). Os 2.000 leads carregados sao os mais recentes do banco — a maioria dos leads simplesmente nao aparece.

Quando o PipeRun sync atualiza um lead que nao esta nos 2.000 carregados, o Realtime tenta adicionar, mas o estado local fica inconsistente. Alem disso, o Realtime do Supabase pode falhar silenciosamente sem fallback.

## Solucao

### 1. Fetch por aba ativa (nao todas de uma vez)

Trocar a query unica `.in("lead_status", ALL_KEYS).limit(2000)` por uma query filtrada pelos status da aba ativa:

```
.in("lead_status", activeTabColumns)
.order("created_at", { ascending: false })
.limit(500)
```

Re-fetch ao trocar de aba. Isso garante que cada aba mostra os 500 leads mais recentes dos seus proprios status.

### 2. Contador real por aba (server-side)

Query separada com `count: "exact"` e `head: true` para mostrar o total real de cada aba nos badges, sem carregar todos os dados.

### 3. Fallback polling (30s)

Adicionar `setInterval` de 30 segundos que re-executa o fetch da aba ativa, como safety net para quando o Realtime falha silenciosamente.

### 4. Filtro do Realtime por status da aba

O subscription Realtime continua global, mas o handler so adiciona/atualiza leads cujo `lead_status` pertence a aba ativa.

### Impacto

| Antes | Depois |
|-------|--------|
| 2.000 leads (todas abas) | 500 por aba ativa |
| Sem fallback | Polling 30s |
| Badges errados | Contagem real server-side |
| est_etapa1 truncado (2k/16.6k) | 500 mais recentes + total real |

### Arquivo alterado
- `src/components/SmartOpsKanban.tsx`

