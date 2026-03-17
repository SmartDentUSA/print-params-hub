

# Plano: Workflow Portfolio — Aba Fluxo

## O que muda

Substituir o bloco simples "Fluxo Digital — mapa de equipamentos" (3 campos fixos, linhas 862-935 de `LeadDetailPanel.tsx`) pela tabela completa **Workflow Portfolio — 7 Etapas × Subcategorias × 3 Camadas**.

## Arquivos

### 1. Criar `src/components/smartops/WorkflowPortfolio.tsx`

Componente React puro que recebe `portfolio` como prop e renderiza:
- Legenda com 4 tipos (Ativo/Concorrente/SDR/Vazio)
- Tabela com scroll horizontal: 7 colunas de etapa (com subcolunas, total 25), 3 linhas (SDR, Mapeamento, Ativos SmartDent)
- Cada célula colorida conforme `layer` (`ativo`=verde, `conc`=âmbar, `sdr`=azul, `vazio`=muted)
- Hits exibidos abaixo do label quando presentes
- Summary bar com contagens

Usará classes CSS inline/Tailwind compatíveis com o tema dark (`.intel-dark`) já existente no projeto.

### 2. Editar `src/components/smartops/LeadDetailPanel.tsx`

**Adicionar estado e fetch do portfolio:**
- Estado: `portfolio` (null inicialmente) + `portfolioLoading`
- Quando `activeTab === "flow"`, chamar `smart-ops-leads-api?action=detail&id={lead.id}` via `supabase.functions.invoke` e extrair `data.portfolio`
- Cache por lead.id (não refetch se já carregado)

**Substituir o bloco da aba "flow" (linhas 862-935):**
- Se `portfolioLoading` → skeleton/spinner
- Se `portfolio` existe → `<WorkflowPortfolio portfolio={portfolio} />`
- Fallback: iframe com `portfolio_embed_url`
- Manter o bloco "Produtos Comprados (e-commerce)" e "Gap Analysis" abaixo da tabela

### 3. Nenhuma migração necessária

Os dados já existem no backend. O endpoint `smart-ops-leads-api?action=detail` já retorna `portfolio` e `portfolio_embed_url`.

## Fluxo de dados

```text
LeadDetailPanel (lead.id)
  └─ activeTab === "flow"
       └─ fetch smart-ops-leads-api?action=detail&id=LEAD_ID
            └─ response.portfolio → <WorkflowPortfolio />
```

## Detalhes técnicos

- Tipos: `Layer`, `PortfolioCell`, `PortfolioStage`, `Portfolio` definidos no `WorkflowPortfolio.tsx`
- Constante `STAGES` com 7 entradas e mapeamento campo→coluna conforme spec
- Cores: `ativo`=#4ade80/verde, `conc`=#fbbf24/âmbar, `sdr`=#60a5fa/azul, `vazio`=#444/muted — usando inline styles para tema dark
- Tabela com `overflowX: auto` e `minWidth: 700px` para scroll horizontal em viewports menores

