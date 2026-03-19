

# Mostrar nome do Lead real no Log de Chegada

## Problema
A aba "Log de Chegada" mostra `entity_name` do `lead_activity_log`, que muitas vezes é o nome do evento/entidade (ex: nome do pedido, nome do curso) e não o nome do lead. O campo `lead_id` existe na tabela mas não é usado para buscar o nome real do lead em `lia_attendances`.

## Correção

### Arquivo: `src/components/SmartOpsLogs.tsx`

1. Incluir `lead_id` na query do `lead_activity_log` (linha 148)
2. Após buscar os registros, extrair os `lead_id`s únicos e fazer uma consulta em `lia_attendances` para obter `nome` e `email`
3. No `mapArrivalRow`, usar o nome do lead resolvido (com fallback para email, depois `entity_name`)
4. Para eventos realtime (novos inserts), buscar o lead name on-the-fly quando o `lead_id` chegar

Mudança concentrada em ~20 linhas no `useEffect` de arrivals e no `mapArrivalRow`.

