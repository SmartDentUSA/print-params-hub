

# Plano: Corrigir Aba Histórico — Dados Faltantes e Imprecisos

## Problemas Identificados

Após análise dos dados reais da API e do banco:

1. **Itens comprados não aparecem**: `piperun_deals_history[].proposals[].items[]` tem detalhes (nome, qtd, valor unitário, total) mas a deal table só mostra dados do deal-nível
2. **Sem contagem de propostas**: Cada deal pode ter N propostas com N itens, mas não há exibição
3. **E-commerce incorreto**: Campo `lojaintegrada_historico_pedidos` está vazio para o lead de teste (Danilo), mas `lojaintegrada_itens_json` tem detalhes de produtos comprados que não são mostrados
4. **Valores arredondados**: `formatBRL` trunca para `k` a partir de R$1000 (ex: R$431 → "R$431" ok, mas R$9518 → "R$10k" perde precisão). Precisa mostrar valor exato com centavos em contextos detalhados
5. **Sem lista de cursos**: `astron_courses_access[]` tem dados ricos (course_name, percentage, completed_classes, total_classes, updated_at) mas apenas mostra "6/6"
6. **Sem data de inscrição Academy**: `astron_created_at` existe no schema

## Mudanças no `LeadDetailPanel.tsx`

### 1. Corrigir `formatBRL` — Usar formato detalhado quando necessário

Criar `formatBRLFull()` que mostra valor com centavos sem abreviação (ex: "R$ 9.518,80"). Usar o formato abreviado apenas no hero e stats, e o formato completo na deal table e timeline.

### 2. Stats Row — Adicionar propostas e corrigir pedidos

Substituir os 6 stats atuais por:
- LTV Total (exato)
- Deals fechados
- Propostas enviadas (contagem de `proposals[]` em todos os deals)
- Pedidos e-com (valor de `lojaintegrada_total_pedidos_pagos` OU length de `lojaintegrada_historico_pedidos`)
- Ticket médio (exato)
- Chamados suporte

### 3. Deal Table — Expandir com itens de propostas

Após cada row do deal, se `deal.proposals` existe, renderizar sub-rows com:
- Sigla da proposta (ex: PRO14338)
- Lista de itens: nome, qtd, valor unitário, valor total
- Frete tipo e valor
- Parcelas

Exemplo visual:
```
Deal #48958 | Funil Estagnados | R$78.500,00 | Aberto
  └ PRO14338 · 8 itens · R$78.500 · Sem Frete
    Scanner Intraoral I600    1× R$68.500
    Notebook Avell A65i       1× R$10.000
    Elegoo Mars 5 Ultra       1× R$5.990 (bonificado)
    ...
```

### 4. Bloco Academy — Nova seção com lista de cursos

Adicionar seção "🎓 Academy" no histórico com:
- Data de inscrição (`astron_created_at`)
- Status da conta
- Tabela de cursos de `astron_courses_access[]`:
  - Nome do curso
  - Aulas: completed/total
  - Progresso: barra + percentage%
  - Última atualização

### 5. E-commerce — Seção de pedidos com itens

Se `lojaintegrada_historico_pedidos.length > 0` OU `lojaintegrada_itens_json.length > 0`:
- Mostrar pedidos do `lojaintegrada_historico_pedidos` com valor exato
- Mostrar itens de `lojaintegrada_itens_json` com nome, qtd, preço

### 6. Timeline — Incluir itens nas entradas de deals

Nos eventos de deals na timeline, adicionar resumo dos itens da proposta no campo `detail`.

## Arquivos

- `src/components/smartops/LeadDetailPanel.tsx` — Expandir aba Histórico com as 6 mudanças acima
- Nenhum outro arquivo modificado

