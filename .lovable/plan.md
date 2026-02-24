
# Adicionar Tabela "Leads por Produto de Interesse" abaixo da Saude do Pipeline

## O que sera feito

Um novo Card sera adicionado ao final do `SmartOpsBowtie.tsx`, logo abaixo da "Saude do Pipeline", exibindo uma tabela com leads agrupados por `produto_interesse`.

### Layout da tabela

| Produto de Interesse | Mes Anterior | % Conversao | Mes Atual | % Conversao | Total Ano | % Conversao (Ano) |
|---|---|---|---|---|---|---|
| Impressora 3D | 12 | 25.0% | 8 | 12.5% | 85 | 18.8% |
| Resina | 5 | 40.0% | 3 | 33.3% | 42 | 35.7% |
| Scanner | ... | ... | ... | ... | ... | ... |

- **Conversao** = leads com `status_atual_lead_crm = 'Ganha'` dividido pelo total de leads naquele produto/periodo
- Linha final com **totais**

## Alteracoes tecnicas

### Arquivo: `src/components/SmartOpsBowtie.tsx`

1. **Expandir a query de leads** para incluir `produto_interesse`:
   - Mudar de `select("score, created_at, status_atual_lead_crm, lead_status")` para incluir `produto_interesse`
   - Atualizar o tipo do estado `allLeads` para incluir `produto_interesse: string | null`

2. **Novo `useMemo`** para calcular a tabela por produto:
   - Agrupar leads por `produto_interesse`
   - Para cada produto, contar leads e conversoes em 3 periodos: mes anterior, mes atual, e ano inteiro (janeiro ate dezembro do ano corrente)
   - Calcular percentuais de conversao

3. **Novo Card** renderizado abaixo do Card "Saude do Pipeline":
   - Titulo: "Leads por Produto de Interesse"
   - Tabela responsiva com as 7 colunas
   - Linha de totais no rodape
   - Leads sem `produto_interesse` agrupados como "Nao Informado"

Nenhuma migration necessaria -- o campo `produto_interesse` ja existe na tabela `lia_attendances`.
