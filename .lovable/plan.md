

# Plano: Sincronizar todos os campos do PipeRun corretamente

## Problemas identificados

Analisando o lead **Fillipe Mateus** (fillipe.mateus@yahoo.com.br):

| Campo PipeRun | Valor no PipeRun | Valor no sistema | Status |
|---|---|---|---|
| Deal ID | 54638811 | 56760558 (outro deal) | O sistema tem apenas o deal do Estagnados |
| Nome | Fillipe Mateus | "Fillipe Mateus - 2026-02-19 21:52..." | Nome com timestamp sujo |
| Produto interesse | BLZ Ino200 | T310 MEDIT BANCADA | Dados do deal diferente |
| Tem scanner | sem scanner ou não definido | null | Não populado |
| Tem impressora | sem impressora ou não definido | null | Não populado |
| Banco Dados ID | 16419 | null | Não populado |
| Informação desejada | BLZ Ino200 | - | Coluna não existe |
| Código contrato | - | - | Coluna não existe |
| Data treinamento | - | - | Coluna não existe |
| Cidade/UF | Não informado | null | OK (sem dado no PipeRun) |

### Causas raiz

1. **Colunas ausentes na tabela**: `informacao_desejada`, `codigo_contrato`, `data_treinamento`, `produto_interesse_auto` não existem em `lia_attendances`
2. **Nome sujo**: `person.name` vem com timestamp do PipeRun ("Nome - 2025-12-08 22:56:51...") e o `cleanDealName` só limpa o título do deal, não o nome da pessoa
3. **Custom fields vazios no deal do Estagnados**: Quando o deal é movido/duplicado para Estagnados, os custom fields podem não copiar. O sync deveria buscar dados do deal original se o atual estiver vazio
4. **Apenas 1 deal por lead**: O sistema grava apenas o `piperun_id` mais recente. Se o lead tem deals em múltiplos funis, dados do deal anterior se perdem

## Correções

### 1. Migration: Adicionar colunas ausentes
```sql
ALTER TABLE lia_attendances 
  ADD COLUMN IF NOT EXISTS informacao_desejada text,
  ADD COLUMN IF NOT EXISTS codigo_contrato text,
  ADD COLUMN IF NOT EXISTS data_treinamento text,
  ADD COLUMN IF NOT EXISTS produto_interesse_auto text;
```

### 2. `piperun-field-map.ts` — Expandir `mapDealToAttendance`
- Extrair custom fields faltantes: `INFORMACAO_DESEJADA` (623602), `CODIGO_CONTRATO` (673917), `DATA_TREINAMENTO` (673925), `PRODUTO_INTERESSE_AUTO` (549148)
- Aplicar `cleanDealName` também no `person.name` para remover timestamps

### 3. `smart-ops-sync-piperun/index.ts` — Não sobrescrever dados com null
No UPDATE de leads existentes, o sync atualmente sobrescreve campos preenchidos com `null` vindos de um deal diferente. Adicionar lógica para **não sobrescrever** campos que já têm valor se o novo valor for null (merge inteligente).

### 4. Limpeza do nome da pessoa
Adicionar lógica em `cleanDealName` (ou nova função `cleanPersonName`) para remover sufixos de timestamp do formato `" - 2025-12-08 22:56:51.531617-03:00"`.

## Arquivos modificados

| Arquivo | Mudança |
|---|---|
| Migration SQL | 4 colunas novas |
| `supabase/functions/_shared/piperun-field-map.ts` | Mapear 4 custom fields + limpar person name |
| `supabase/functions/smart-ops-sync-piperun/index.ts` | Merge inteligente (não sobrescrever com null) |

