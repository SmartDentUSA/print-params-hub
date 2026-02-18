
# Painel Admin: Estatísticas da Dra. L.I.A.

## O que será criado

Um novo componente `AdminDraLIAStats` que será inserido dentro da aba **Estatísticas** (`value="stats"`) já existente no `AdminViewSecure.tsx`, logo abaixo do `<AdminStats />` atual. Não é necessário criar uma nova aba — a aba "Estatísticas" já existe e é o lugar correto para este painel.

---

## Dados utilizados (tabelas existentes no Supabase)

### `agent_interactions`
Campos relevantes:
- `created_at` — para agrupar por dia
- `feedback` — valores: `'none'`, `'positive'`, `'negative'`
- `unanswered` — boolean indicando se a pergunta ficou sem resposta
- `lang` — idioma da interação

### `agent_knowledge_gaps`
Campos relevantes:
- `question` — pergunta sem resposta
- `frequency` — quantas vezes foi feita
- `status` — `'pending'`, `'resolved'`, etc.
- `created_at`

---

## Componente: `AdminDraLIAStats`

**Arquivo a criar:** `src/components/AdminDraLIAStats.tsx`

### Seção 1 — Cartões de resumo (KPIs)

4 cards no topo:

| KPI | Fonte |
|---|---|
| Total de interações (últimos 30 dias) | `COUNT(*)` em `agent_interactions` |
| Taxa de satisfação 👍 | `SUM(feedback='positive') / total com feedback` |
| Perguntas sem resposta | `COUNT(unanswered=true)` |
| Lacunas de conhecimento pendentes | `COUNT(*)` em `agent_knowledge_gaps WHERE status='pending'` |

### Seção 2 — Gráfico de interações por dia (Recharts)

Gráfico de barras usando `BarChart` do `recharts` (já instalado no projeto):
- Eixo X: data (últimos 30 dias)
- Barras empilhadas: Total de interações por dia
- Cores: barra azul para total, linha verde para positivos

Query usada:
```sql
SELECT 
  date_trunc('day', created_at)::date as day,
  COUNT(*) as total,
  SUM(CASE WHEN feedback = 'positive' THEN 1 ELSE 0 END) as positive,
  SUM(CASE WHEN feedback = 'negative' THEN 1 ELSE 0 END) as negative
FROM agent_interactions
WHERE created_at >= now() - interval '30 days'
GROUP BY 1
ORDER BY 1 ASC
```

Implementado via Supabase JS client com `.rpc()` ou seleção direta na tabela com filtro de data.

### Seção 3 — Gauge de satisfação 👍/👎

Card com visualização circular simples usando `RadialBarChart` do Recharts:
- Centro: percentual de 👍
- Legenda: `X positivos / Y negativos / Z sem avaliação`

### Seção 4 — Top 10 perguntas sem resposta

Tabela com colunas:
- Pergunta
- Frequência (badge com número)
- Status (badge colorido: `pending` = laranja, `resolved` = verde)
- Data

Query:
```sql
SELECT question, frequency, status, created_at 
FROM agent_knowledge_gaps 
ORDER BY frequency DESC, created_at DESC
LIMIT 10
```

Cada linha terá um botão **"Marcar como resolvido"** que atualiza `status = 'resolved'` na tabela via Supabase JS.

---

## Integração no AdminViewSecure.tsx

**Arquivo a editar:** `src/pages/AdminViewSecure.tsx`

Adicionar import:
```typescript
import { AdminDraLIAStats } from "@/components/AdminDraLIAStats";
```

Adicionar no `TabsContent value="stats"`:
```tsx
<TabsContent value="stats" className="space-y-6">
  <AdminStats />
  <AdminDraLIAStats />   {/* NOVO */}
</TabsContent>
```

---

## Tratamento de estado vazio

Como as tabelas estão atualmente vazias, o componente deve mostrar estados `empty` elegantes:
- Gráfico: mensagem "Nenhuma interação registrada ainda"
- Tabela: "Nenhuma lacuna de conhecimento pendente"
- KPI cards: mostrar `0` com texto de contexto

---

## Arquivos modificados

| Arquivo | Ação |
|---|---|
| `src/components/AdminDraLIAStats.tsx` | Criar — componente completo com KPIs, gráfico e tabela |
| `src/pages/AdminViewSecure.tsx` | Editar — import + adicionar `<AdminDraLIAStats />` na aba stats |

---

## Seção Técnica

- Recharts (`BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`, `RadialBarChart`, `RadialBar`, `Legend`) já estão disponíveis no projeto (pacote `recharts ^2.15.4` instalado, padrão `ChartContainer` em `src/components/ui/chart.tsx`).
- O acesso é controlado por RLS: `agent_interactions` e `agent_knowledge_gaps` só permitem leitura/escrita para admins — o componente só aparece para `isAdmin`.
- A atualização de status no `agent_knowledge_gaps` usa `.update({ status: 'resolved' }).eq('id', gap.id)` via Supabase JS, protegida pela política RLS existente de admin.
- Sem migrações de banco de dados necessárias — as tabelas e políticas já existem.
