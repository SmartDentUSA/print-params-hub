

# Plano: Automacoes por Vendedor + Metas Editaveis + Lista de Leads

## O que sera implementado

### 1. Nova aba "Leads" no SmartOpsTab

Uma tabela paginada completa com todos os leads da `lia_attendances`, mostrando os campos mais relevantes com scroll horizontal.

**Arquivo:** Novo `src/components/SmartOpsLeadsList.tsx`

Funcionalidades:
- Tabela com colunas: Nome, Email, Telefone, Produto Interesse, Status, Score, Proprietario CRM, Source, Data Contato, Ativos (icones)
- Busca por nome/email
- Filtro por `lead_status` (dropdown com as 7 etapas do Piperun)
- Filtro por `source`
- Paginacao client-side (50 por pagina)
- Clique na linha abre dialog com TODOS os 52 campos do lead (somente leitura)
- Exportar CSV dos leads filtrados

**Arquivo:** `src/components/SmartOpsTab.tsx`
- Adicionar nova aba "Leads" (7 abas no total, `grid-cols-7`)
- Importar e renderizar `SmartOpsLeadsList`

---

### 2. Metas editaveis via `site_settings`

Em vez de constantes hardcoded, as metas serao salvas na tabela `site_settings` (ja existente) com chaves prefixadas `smartops_`.

**Arquivo:** Novo `src/components/SmartOpsGoals.tsx`
- Dialog/modal acessivel por botao "Configurar Metas" no `SmartOpsBowtie`
- Campos editaveis: MQL, SQL, Vendas, CS Contratos, CS Onboarding, CS Ongoing, Pipeline Meta
- Salva na tabela `site_settings` via upsert com chaves: `smartops_goal_mql`, `smartops_goal_sql`, etc.
- Ao abrir, carrega valores existentes

**Arquivo:** `src/components/SmartOpsBowtie.tsx`
- Substituir constantes `GOALS` e `PIPELINE_META` por estado carregado de `site_settings`
- Adicionar `useEffect` para buscar metas do banco
- Adicionar botao "Configurar Metas" (icone engrenagem) no header do Card principal
- Fallback para valores default caso nao existam no banco

---

### 3. Painel de automacoes por vendedor

**Arquivo:** Novo `src/components/SmartOpsSellerAutomations.tsx`

Exibido dentro da aba "Equipe" (abaixo da tabela de membros) ou como sub-tab.

Funcionalidades:
- Para cada vendedor ativo, mostra um card com:
  - Nome e WhatsApp
  - Quantidade de leads atribuidos (`proprietario_lead_crm = nome_completo`)
  - Leads por status (mini grafico de barras ou badges)
  - Taxa de conversao individual (leads ganhos / leads totais)
  - Ultimo lead recebido (data)
- Resumo geral: ranking de vendedores por performance

**Arquivo:** `src/components/SmartOpsTeam.tsx`
- Importar e renderizar `SmartOpsSellerAutomations` abaixo da tabela de equipe

---

## Resumo de arquivos

| Arquivo | Acao |
|---|---|
| `src/components/SmartOpsLeadsList.tsx` | Criar - tabela completa de leads |
| `src/components/SmartOpsGoals.tsx` | Criar - modal de metas editaveis |
| `src/components/SmartOpsSellerAutomations.tsx` | Criar - painel por vendedor |
| `src/components/SmartOpsTab.tsx` | Editar - adicionar aba "Leads" |
| `src/components/SmartOpsBowtie.tsx` | Editar - carregar metas do banco + botao config |
| `src/components/SmartOpsTeam.tsx` | Editar - incluir painel por vendedor |

Nenhuma migration necessaria - usa tabelas existentes (`lia_attendances`, `site_settings`, `team_members`).

