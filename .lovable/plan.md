

# Adicionar aba "Calculadoras ROI" dentro de Conteúdo

## O que será feito

Adicionar uma sub-aba **"Calculadoras ROI"** dentro da aba Conteúdo do Smart Ops. Essa aba permitirá criar e gerenciar calculadoras interativas de ROI que podem ser embutidas em formulários públicos ou páginas do site.

## Alterações

### 1. Criar `src/components/SmartOpsROICalculators.tsx` (novo)
Componente com CRUD para gerenciar calculadoras ROI. Cada calculadora terá:
- **Nome** e **Slug** (para URL pública)
- **Tipo**: Impressora 3D, Scanner, Software CAD, Fluxo Completo
- **Campos de entrada**: investimento inicial, custo por peça terceirizada, volume mensal, custo operacional
- **Fórmula de cálculo**: payback em meses, economia mensal, ROI percentual
- **Status**: rascunho / publicado
- **Preview** inline do resultado

Layout: tabela listando calculadoras existentes + botão "Nova Calculadora" abrindo Dialog com formulário de configuração.

### 2. Alterar `src/components/SmartOpsContentProduction.tsx`
Envolver o conteúdo atual em um sub-`Tabs` com duas abas:
- **"Produção"** (conteúdo atual, default)
- **"Calculadoras ROI"** (novo componente)

### 3. Tabela Supabase (via query)
Verificar se existe tabela `roi_calculators`. Se não, o componente usará estado local com opção de salvar no `lia_content_requests` com `tipo_conteudo = 'roi_calculator'` como alternativa sem migração.

## Resultado
- Nova sub-aba visível em Smart Ops → Conteúdo → Calculadoras ROI
- Interface para criar/editar calculadoras com preview dos cálculos
- Pronto para futura publicação como página pública (`/f/roi-scanner` etc.)

