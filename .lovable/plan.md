

## Plano: Integrar dados Omie ERP no Hero Card do Lead

### Problema identificado

O card do lead (LeadDetailPanel) tem abas dedicadas "🏭 Dados do ERP" e "💰 Financeiro" que exibem corretamente os dados do Omie. Porém, o **hero card** (resumo principal visível ao abrir o lead) mostra apenas dados de CRM (PipeRun) e E-commerce (Loja Integrada), ignorando completamente:

- **Faturamento Omie** (receita real confirmada pelo ERP)
- **Omie Score** (0-100) e classificação operacional (PRIORIDADE, RECUPERACAO, etc.)
- **Flag de inadimplência** (alertas de parcelas vencidas)
- **Dias sem comprar** (indicador de reativação)

Isso faz com que o vendedor precise navegar até a aba ERP para ver informações críticas de decisão.

### Solução

Adicionar ao hero card do `LeadDetailPanel` um bloco "ERP Omie" que exiba:

1. **Faturamento ERP** ao lado do "Financeiro Total (CRM + E-com)" existente
2. **Badge de classificação Omie** (PRIORIDADE/RECUPERACAO/REATIVACAO/ATIVO/MONITORAR) no hero
3. **Alerta de inadimplência** quando `omie_inadimplente = true`
4. **Score Omie** como badge compacto ao lado do LIS score

### Arquivos a modificar

**`src/components/smartops/LeadDetailPanel.tsx`**

1. No bloco hero (linhas ~1029-1075), após "Financeiro Total (CRM + E-com)":
   - Adicionar bloco "Faturamento ERP Omie" usando `ld.omie_faturamento_total`
   - Exibir grid: Faturamento Total | Recebido | Em Aberto | % Quitado
   - Badge de classificação (`ld.omie_classificacao`) com cores (verde/vermelho/laranja/azul/cinza)
   - Alert inline se `ld.omie_inadimplente === true`

2. No hero badges row (linhas ~1012-1022):
   - Adicionar badge do Omie Score: `🏭 Score ERP: {omie_score}` com cor por faixa
   - Adicionar badge de inadimplência: `⚠️ Inadimplente` em vermelho
   - Adicionar badge de dias sem comprar quando > 90 dias

3. No `financeiroTotal` (linha ~544):
   - Somar `omie_faturamento_total` ao total consolidado, usando o maior entre CRM Won e Omie (para evitar double-counting quando faturamento Omie já reflete deals ganhos)

4. Nos `stats` (linhas ~613-619):
   - Adicionar stat box "Score ERP" com o valor do `omie_score`

### Detalhes Técnicos

- Os dados já estão disponíveis em `detail.lead` (alias `ld`) porque o endpoint `smart-ops-leads-api` retorna todas as colunas de `lia_attendances`, incluindo `omie_faturamento_total`, `omie_valor_pago`, `omie_valor_em_aberto`, `omie_score`, `omie_classificacao`, `omie_inadimplente`, `omie_dias_sem_comprar`
- Não é necessário criar novo hook ou query — os dados já chegam pelo fluxo existente
- O `ErpDataTab` e `FinanceiroTab` continuam funcionando independentemente (sem mudanças)
- Cores e labels da classificação Omie seguem o padrão já definido no `ErpDataTab` (`CLASSIFICACAO_CONFIG`)

