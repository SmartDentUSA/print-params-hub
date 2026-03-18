

# Enriquecer contexto da Dra. LIA com cursos Astron e pedidos e-commerce

## Situacao Atual

### Astron (cursos)
- A LIA recebe apenas dados **agregados**: status do aluno, nomes dos planos ativos, e contagem total/concluídos de cursos
- Os **nomes dos cursos**, **% de progresso**, e **data de início** existem na tabela `lead_course_progress` mas **nao sao consultados** pela Dra. LIA
- Resultado: se o lead perguntar "em que curso estou?", a LIA sabe que ele tem 2/5 cursos concluídos, mas nao sabe quais

### E-commerce (pedidos Loja Integrada)
- A LIA recebe apenas **quantidade de pedidos** e **valor do último pedido**
- Os campos armazenados no JSONB `lojaintegrada_historico_pedidos` incluem: `numero`, `valor_total`, `situacao_nome`, `data_criacao` — mas **nao** incluem código de rastreio nem link de pagamento
- O sync (`sync-loja-integrada-clients`) **nao captura** `link_rastreio`, `url_pagamento`, `envios`, `pagamentos` da API da Loja Integrada
- Resultado: mesmo que o pedido tenha rastreio, a LIA nao tem como informar

## Plano de Implementacao

### 1. Enriquecer contexto Astron na LIA (dra-lia/index.ts)
Apos o bloco de Astron Members context (linhas 1918-1928), adicionar query a `lead_course_progress`:

```typescript
// Fetch individual course details
const { data: courseProgress } = await supabase
  .from("lead_course_progress")
  .select("course_name, status, progress_pct, lessons_completed, lessons_total, started_at")
  .eq("lead_id", attendance.id)
  .order("started_at", { ascending: false })
  .limit(10);

if (courseProgress && courseProgress.length > 0) {
  const courseLines = courseProgress.map(c => 
    `• ${c.course_name}: ${c.progress_pct || 0}% (${c.lessons_completed || 0}/${c.lessons_total || '?'} aulas) - ${c.status} - Início: ${c.started_at ? new Date(c.started_at).toLocaleDateString("pt-BR") : "?"}`
  ).join("\n");
  profileFields.push(`📚 Cursos detalhados:\n${courseLines}`);
}
```

### 2. Capturar rastreio e pagamento no sync (sync-loja-integrada-clients)
Adicionar campos ao mapeamento de pedidos (linhas 121-136):

```typescript
// Adicionar ao objeto de cada pedido:
link_rastreio: p.envios?.[0]?.objeto || p.envios?.[0]?.url || null,
url_pagamento: p.pagamentos?.[0]?.link_boleto || p.pagamentos?.[0]?.link_pix || null,
forma_pagamento: p.pagamentos?.[0]?.forma_pagamento?.nome || null,
itens_resumo: (p.itens || []).slice(0, 5).map(i => i.nome || i.sku).join(", "),
```

**Nota**: Os campos `envios`, `pagamentos` e `itens` podem nao estar presentes no endpoint `/pedido/` (list). Se nao estiverem, sera necessario fazer um fetch individual `/pedido/{id}/` para cada pedido — o que tem custo de rate limit. Alternativa: capturar esses campos apenas no webhook (`smart-ops-ecommerce-webhook`), que recebe o payload completo.

### 3. Enriquecer contexto e-commerce na LIA (dra-lia/index.ts)
Expandir o bloco de e-commerce (linhas 1944-1948) para mostrar detalhes dos pedidos:

```typescript
if (ecomHistory && ecomHistory.length > 0) {
  profileFields.push(`🛒 Pedidos e-commerce: ${ecomHistory.length}`);
  const orderLines = ecomHistory.slice(0, 5).map((o, i) => {
    let line = `• #${o.numero || i+1}: R$${o.valor_total || "?"} - ${o.situacao_nome || "?"} (${o.data_criacao ? new Date(o.data_criacao).toLocaleDateString("pt-BR") : "?"})`;
    if (o.link_rastreio) line += ` | Rastreio: ${o.link_rastreio}`;
    if (o.url_pagamento) line += ` | Pagamento: ${o.url_pagamento}`;
    if (o.itens_resumo) line += ` | Itens: ${o.itens_resumo}`;
    return line;
  }).join("\n");
  profileFields.push(`📦 Detalhes pedidos:\n${orderLines}`);
}
```

## Arquivos Alterados
1. `supabase/functions/dra-lia/index.ts` — query `lead_course_progress` + expandir bloco e-commerce
2. `supabase/functions/sync-loja-integrada-clients/index.ts` — capturar `envios`, `pagamentos`, `itens` no mapeamento
3. `supabase/functions/smart-ops-ecommerce-webhook/index.ts` — garantir que webhook tambem salva esses campos

## Risco
- Os campos `envios`/`pagamentos`/`itens` podem exigir fetch individual por pedido na API LI (rate limit). Recomendo primeiro verificar se o endpoint de lista ja retorna esses campos. Caso contrario, capturar apenas via webhook (que recebe payload completo).

