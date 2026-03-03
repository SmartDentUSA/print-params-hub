

# Plano: Usar data do PipeRun como "Criado em"

## Problema

O campo "Criado em" no card e no detalhe do lead mostra `created_at` (data de entrada no sistema local), perdendo a timeline real do lead no CRM.

## Correção

A tabela `lia_attendances` já possui o campo `piperun_created_at`. Basta:

### 1. `KanbanLeadCard.tsx`
- Adicionar `piperun_created_at` à interface `Lead`
- Alterar a exibição da data no card: usar `piperun_created_at` quando disponível, fallback para `created_at`

### 2. `SmartOpsKanban.tsx`
- Adicionar `piperun_created_at` ao `LEAD_SELECT` string

### 3. `KanbanLeadDetail.tsx`
- Na seção "Datas", mostrar "Criado em (PipeRun)" com `piperun_created_at` e "Entrada no sistema" com `created_at` separadamente, para manter visibilidade de ambas as datas

Nenhuma migração de banco necessária — o campo já existe.

