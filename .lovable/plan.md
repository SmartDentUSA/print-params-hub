

# Adicionar Filtro de Workflow de Interesse ao Audience Builder

## Problema

O componente `SmartOpsAudienceBuilder` tem filtro de **Produtos Ativos** (`ativo_scan`, `ativo_print`, etc.) mas falta o filtro de **Produtos de Interesse** baseado nos campos SDR:

| Campo DB | Categoria |
|----------|-----------|
| `sdr_scanner_interesse` | Scanner |
| `sdr_impressora_interesse` | Impressora |
| `sdr_software_cad_interesse` | Software CAD |
| `sdr_pos_impressao_interesse` | Pós-impressão |
| `sdr_caracterizacao_interesse` | Caracterização |
| `sdr_cursos_interesse` | Cursos |
| `sdr_dentistica_interesse` | Dentística |
| `sdr_insumos_lab_interesse` | Insumos Lab |
| `sdr_solucoes_interesse` | Soluções |

## Alterações em `SmartOpsAudienceBuilder.tsx`

1. **Adicionar `interestProduct` ao tipo `Filters`** e ao `EMPTY_FILTERS`
2. **Criar constante `INTEREST_OPTIONS`** com as 9 categorias SDR
3. **Adicionar Select na filter bar** (linha dos filtros avançados, ao lado de "Produtos Ativos")
4. **Aplicar filtro na query**: `query = query.not("sdr_X_interesse", "is", null)` quando selecionado
5. **Adicionar chip de filtro ativo** na barra de chips removíveis
6. **Adicionar campos SDR ao `LeadRow`** interface e ao select da query
7. **Mostrar coluna "Interesse"** na tabela com badges dos campos SDR preenchidos

Isso permite criar públicos como: "leads que QUEREM scanner mas NÃO TÊM scanner" (interestProduct=scanner + activeProduct=scan invertido).

## Ficheiro editado
- `src/components/SmartOpsAudienceBuilder.tsx`

