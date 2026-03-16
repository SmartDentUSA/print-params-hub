

## Por que a visualização ainda está antiga

**O problema**: A transformação foi aplicada no componente errado.

- A aba **"Público / Lista"** (que você usa e está nos screenshots) renderiza `SmartOpsAudienceBuilder.tsx` — este **não foi alterado**
- A aba **"Leads"** renderiza `SmartOpsLeadsList.tsx` — este **foi alterado** para o layout dark split-panel

Os screenshots mostram o header "Público / Lista (26.536 leads)" que é o `SmartOpsAudienceBuilder`.

### Correção

Aplicar o mesmo layout dark split-panel ao `SmartOpsAudienceBuilder`, que é o componente real que lista os 26k+ leads com a tabela + dialog modal. Duas opções:

1. **Unificar**: Substituir o `SmartOpsAudienceBuilder` pelo `SmartOpsLeadsList` já transformado (mover filtros de pipeline/status para lá)
2. **Transformar in-place**: Reescrever o `SmartOpsAudienceBuilder` com o mesmo layout dark

Opção 1 é mais limpa — o `SmartOpsLeadsList` já tem toda a lógica dark + tabs + behavioral. Basta:

| Arquivo | Ação |
|---|---|
| `SmartOpsTab.tsx` | Na tab `kanban`, trocar `<SmartOpsAudienceBuilder>` por `<SmartOpsLeadsList>` |
| `SmartOpsLeadsList.tsx` | Incorporar os filtros avançados do AudienceBuilder (pipeline groups, status, proprietário) que não existem lá |
| `SmartOpsTab.tsx` | Remover a tab "Leads" separada (ficaria duplicada) |

### O que precisa ser migrado do AudienceBuilder → LeadsList

- Filtros por pipeline group (Vendas, CS, Estagnados, Insumos, E-commerce, Ebook)
- Filtro por status específico dentro do pipeline
- Filtro por proprietário CRM
- Contagem total de leads no header
- Export CSV com 200 registros
- Inline edit de campos (save direto na tabela)

O layout dark, hero card, tabs de detalhe, timeline, behavioral, e todas as 10 tabelas já estão no `SmartOpsLeadsList`.

