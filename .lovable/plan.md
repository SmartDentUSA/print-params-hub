

# Fix: Copilot IA — Lacunas de Consulta e Mapeamento

## Problemas Identificados

O Copilot está reportando 3 lacunas reais:

1. **Consulta de deals "ganhos" falha**: O campo `piperun_deals_history` é JSONB array. Quando o Copilot tenta buscar deals por status dentro desse array usando `where_text_search` (que faz `.ilike()` no Supabase), falha porque `.ilike()` não funciona nativamente em colunas JSONB — precisa de cast `::text`.

2. **Campos do webhook não mapeados no prompt**: O system prompt lista campos disponíveis mas não menciona `company`, `origin`, `activities` — campos que JÁ são mapeados no `piperun-field-map.ts` mas o Copilot não sabe que existem em `lia_attendances`.

3. **Falta ferramenta dedicada para consultar deal history**: O Copilot tenta usar `query_leads_advanced` para buscar dentro do JSONB, mas a implementação de `where_text_search` usa `.ilike()` que não penetra JSONB arrays.

## Plano de Implementação

### 1. Nova tool: `query_deal_history`
Adicionar ferramenta dedicada que faz query SQL direta no JSONB `piperun_deals_history` usando `::text ILIKE` ou lateral join com `jsonb_array_elements`. Permite buscar:
- Deals por status (`ganho`, `perdido`, `aberto`)
- Deals por produto (item nome)
- Deals por valor (range)
- Deals por vendedor (owner_name)

### 2. Fix `where_text_search` para JSONB
No `applyAdvancedFilters`, detectar campos JSONB conhecidos (`piperun_deals_history`, `cognitive_analysis`, `proposals_data`, `portfolio_json`) e usar RPC ou cast `::text` ao invés de `.ilike()` direto.

### 3. Atualizar System Prompt
Adicionar ao prompt:
- Campos de empresa: `empresa_nome`, `empresa_cnpj`, `empresa_piperun_id`
- Campos de origem: `piperun_origin_name`, `original_source`, `source_reference`
- Menção explícita da tool `query_deal_history` para consultas de histórico de deals
- Campos de atividade: `piperun_activities_count`, `piperun_last_activity_at`

### 4. Adicionar RPC para busca em JSONB
Migration SQL para criar uma função `fn_search_deals_by_status` que faz lateral join eficiente no `piperun_deals_history`.

## Arquivos Alterados

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/smart-ops-copilot/index.ts` | Nova tool `query_deal_history`, fix `where_text_search` para JSONB, system prompt expandido |
| Migration SQL | `fn_search_deals_by_status(status text, limit int)` |

