

## Plano: Adicionar campos `sdr_*` na tabela `lia_attendances`

### Migration SQL

Adicionar os seguintes campos com prefixo `sdr_` na tabela `lia_attendances`:

```sql
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_scanner_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_impressora_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_software_cad_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_caracterizacao_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_cursos_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_dentistica_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_insumos_lab_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_pos_impressao_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_solucoes_interesse text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_marca_impressora_param text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_modelo_impressora_param text;
ALTER TABLE lia_attendances ADD COLUMN IF NOT EXISTS sdr_resina_param text;
```

### Arquivos a editar

| # | Arquivo | Mudanca |
|---|---------|---------|
| 1 | Migration SQL | 12 novos campos `sdr_*` em `lia_attendances` |
| 2 | `supabase/functions/dra-lia/index.ts` | Persistir selecoes das 3 rotas nos campos `sdr_*` via `extractImplicitLeadData` ou handler dedicado |
| 3 | `src/components/DraLIA.tsx` | Enviar `product_selections` no payload quando lead clica em produtos nas rotas |
| 4 | `src/components/CommercialFlow.tsx` | Capturar selecao (scan/cad/print) e propagar via callback |
| 5 | `src/components/ProductsFlow.tsx` | Capturar categoria selecionada e propagar |
| 6 | `src/components/PrinterParamsFlow.tsx` | Capturar marca/modelo/resina e propagar |
| 7 | SmartOps UI (lead detail) | Renomear "Equipamentos" para "Solucoes de interesse" e exibir os novos campos `sdr_*` agrupados por rota |

### Mapeamento Rota → Campo

**Rota 1 (Comercial):** scan → `sdr_scanner_interesse`, cad → `sdr_software_cad_interesse`, print → `sdr_impressora_interesse`

**Rota 2 (Produtos):** categoria → campo correspondente (`CURSOS` → `sdr_cursos_interesse`, etc.). Scanner/Impressora/CAD compartilhados com Rota 1.

**Rota 3 (Parametros):** marca → `sdr_marca_impressora_param`, modelo → `sdr_modelo_impressora_param`, resina → `sdr_resina_param`

