## Diagnóstico

O botão **"Enfileirar 136 leads"** (Central de Campanhas → Wizard de Email) chama a edge function `smart-ops-send-gmail` no modo *enqueue*. A UI mostra **136 leads** porque o `SmartOpsCampaigns.tsx` calcula esse número usando `applyFiltersToQuery` (~35 filtros ricos: `piperun_stage_name`, `temperatura_lead`, `recencia_dias`, `score_min`, `real_status`, `marca_scanner`, `imprime_modelos`, etc.).

Já a edge function só entende **4 filtros**: `uf`, `etapa_funil`, `produto_interesse`, `temperatura`. Todos os demais são **silenciosamente ignorados**.

Consequência: a query da função retorna um universo muito maior (limitado em `.limit(5000)`), tentando montar `campaign_send_log` para milhares de leads em vez de 136. Isso:

1. Distorce a fila (audience salvo em `campaigns.audience_count` não bate com o que o usuário viu).
2. Estoura o tempo de execução no `bulk insert` × 10 chunks, retornando `500` como *"Edge Function returned a non-2xx status code"*.

Além disso, o `edge_function_logs` de `smart-ops-send-gmail` está vazio recentemente, reforçando que a função está caindo antes de chegar ao insert final.

## Fix

**Alinhar o filtro do servidor com o do cliente** — sem tocar em lógica de negócio nem no wizard.

### 1. `supabase/functions/smart-ops-send-gmail/index.ts`

Substituir o bloco atual (linhas ~336–348):

```ts
let q = supabase.from("lia_attendances")
  .select("id, nome, email, responsavel_id")
  .is("merged_into", null)
  .not("email", "is", null)
  .neq("email", "")
  .limit(5000);
if (filters.uf) q = q.eq("uf", filters.uf);
if (filters.etapa_funil) q = q.eq("etapa_funil", filters.etapa_funil);
if (filters.produto_interesse) q = q.eq("produto_interesse", filters.produto_interesse);
if (filters.temperatura) q = q.eq("temperatura", filters.temperatura);
```

Por uma função `applyCampaignFilters(q, filters)` que reproduz **exatamente** o `applyFiltersToQuery` do `SmartOpsCampaigns.tsx` (linhas 636–702) — mesmos operadores `or/eq/ilike/is/not.is/gte`, mesma normalização de vírgulas, mesmo tratamento `yes/no`.

Manter os guards básicos (`merged_into IS NULL`, `email NOT NULL`, `email <> ''`) e o `.limit(5000)` como safety net.

### 2. Log de instrumentação

Adicionar `console.log("[send-gmail] enqueue filters=", filters, "audience=", leads.length)` antes do `insert` para facilitar diagnóstico se algo escapar.

### 3. Guardrail de sanidade

Se `leads.length === 0` retornar `{ ok: false, error: "audience_empty" }` com HTTP 200 (não 500), para o front conseguir mostrar mensagem clara.

### O que **NÃO** muda

- Wizard `EmailCampaignWizard.tsx`: nenhuma alteração.
- Fluxo de envio (`smart-ops-email-scheduler-tick` + `sendOne`): intacto.
- Schema DB: nenhuma migration.
- Segmentações salvas: continuam usando os mesmos filtros.

## Deploy

Chamar `supabase--deploy_edge_functions` com `["smart-ops-send-gmail"]` após a edição.

## Verificação

Após o deploy, o usuário refaz o fluxo com os mesmos filtros: a resposta deve dizer `audience: 136` e o `campaign_send_log` deve ter exatamente 136 linhas *queued*.
