

# Transformar Kanban em Lista Avançada de Públicos

## Contexto

A tab "Kanban" atual (`SmartOpsKanban`) exibe cards em colunas drag-and-drop. O pedido é substituir por uma **lista tabular completa** com filtros avançados para criação de públicos/segmentos. Já existe `SmartOpsLeadsList` com 5 filtros — a nova versão terá **15+ filtros** cobrindo todos os eixos do CDP.

## Abordagem

Criar um novo componente `SmartOpsAudienceBuilder` que substitui o Kanban na tab. Reutiliza os sub-componentes existentes do `SmartOpsLeadsList` (badges, detail dialog, etc.) mas com arquitetura de filtros muito mais rica.

## Filtros Disponíveis (15 eixos)

| Grupo | Filtros | Campo DB |
|-------|---------|----------|
| **Identificação** | Busca texto (nome/email/tel) | `nome`, `email`, `telefone_normalized` |
| **Funil CRM** | Pipeline (Vendas, Estagnados, CS, Insumos, E-commerce, Ebook) | `lead_status` agrupado por pipeline |
| **Status** | Status individual dentro do pipeline | `lead_status` |
| **Temperatura** | Quente/Morno/Frio | `temperatura_lead` |
| **Estágio Cognitivo** | MQL/SAL/SQL/Cliente | `lead_stage_detected` |
| **Origem** | Source do lead | `source` |
| **Produto Interesse** | Produto de interesse | `produto_interesse` |
| **Itens Proposta** | Scanner/Impressora/CAD/Insumos (parsed) | `itens_proposta_parsed` via JSONB |
| **UF** | Estado | `uf` |
| **Proprietário** | Vendedor responsável | `proprietario_lead_crm` |
| **Oportunidade** | Aberta/Ganha/Perdida | `status_oportunidade` |
| **Produtos Ativos** | Scan/Print/CAD/etc. | `ativo_scan`, `ativo_print`... |
| **Tags CRM** | Tags do CRM | `tags_crm` contains |
| **Urgência** | Alta/Média/Baixa | `urgency_level` |
| **Período** | Data de criação (range) | `created_at` |
| **Estagnados** | >30d sem atualização | `updated_at` |
| **Valor** | Range de valor oportunidade | `valor_oportunidade` |

## Estrutura do Componente

```text
SmartOpsAudienceBuilder
├── Header (contagem + export CSV + reset filtros)
├── FilterBar (grid responsivo de selects/inputs)
│   ├── Row 1: Busca | Pipeline | Status | Temperatura | Urgência
│   ├── Row 2: Origem | Produto | UF | Proprietário | Oportunidade
│   ├── Row 3: Estágio | Produtos Ativos | Tags | Período | Valor
│   └── Collapse/Expand para filtros avançados
├── ActiveFilters (chips removíveis mostrando filtros ativos)
├── Table (colunas: Nome/Email | Cidade/UF | Pipeline | Status | Temp | Produto | Valor | Score | Proprietário | Cognitivo | Data | Ativos)
├── Pagination
└── LeadDetailDialog (reutilizado do SmartOpsLeadsList)
```

## Ficheiros

1. **Criar** `src/components/SmartOpsAudienceBuilder.tsx` — novo componente (~600 linhas)
   - Todos os filtros server-side via Supabase query builder
   - Reutiliza badges/helpers do SmartOpsLeadsList (TempBadge, StageBadge, etc.)
   - Export CSV com todos os campos visíveis
   - Paginação server-side (200/página)
   - Contagem de resultados em tempo real
   - Chips de filtros ativos com "X" para remover
   - Botão "Limpar Filtros"
   - Realtime subscription para updates

2. **Editar** `src/components/SmartOpsTab.tsx` — trocar `SmartOpsKanban` por `SmartOpsAudienceBuilder` na tab "Kanban", renomear label para "Público / Lista"

## Detalhes Técnicos

- Os filtros de Pipeline agrupam os `lead_status` keys pelos mesmos grupos do antigo Kanban (Vendas, Estagnados, CS, etc.)
- Filtro de `itens_proposta_parsed` usa `jsonb` containment query (`@>`)
- Filtro de `tags_crm` usa `cs` (contains) operator
- Filtro de Produtos Ativos usa `eq("ativo_X", true)` combinado
- Filtro de período usa `gte`/`lte` em `created_at`
- Filtro de valor usa `gte`/`lte` em `valor_oportunidade`
- Todos os filtros são server-side para performance com datasets grandes

