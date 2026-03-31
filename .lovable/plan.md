

# Implementacao: Enriquecimento Financeiro Omie — 6 Etapas

O arquivo uploaded contem o spec completo e final com todas as correcoes das auditorias anteriores. A implementacao segue exatamente o spec.

## Etapa 1 — Migration SQL

Criar migration com 5 blocos:
- **Bloco 1**: 17 colunas financeiras + `omie_classificacao` + 4 cursors de idempotencia + 3 indexes + UNIQUE index parcial em `omie_parcelas(omie_titulo_id)` + index por lead/vencido
- **Bloco 2**: DROP `real_status` GENERATED → coluna normal + trigger `fn_set_real_status()` BEFORE INSERT OR UPDATE + backfill existentes
- **Bloco 3**: `fn_omie_score_label(score)` IMMUTABLE
- **Bloco 4**: `fn_enrich_lead_from_omie(p_lead_id)` — faturamento de `deal_items WHERE source='omie_nfe'`, financeiro de `omie_parcelas`, score ponderado (40% pontualidade + 20% recencia + 20% ticket + 20% frequencia - penalidades), classificacao operacional, `ltv_total` sincronizado
- **Bloco 5**: Tabela `omie_sync_cursors` + `fn_map_omie_titulo_status()`

## Etapa 2 — Substituir `omie-lead-enricher/index.ts`

Substituicao completa (731 → ~1270 linhas). Diferencas chave:
- `normalizePhone()`: formato unico `5511999999999`
- `enrichLead()` + `flushEnrichQueue()`: batch de enriquecimento via SQL
- Cursor system: `getCursor()`/`saveCursor()` com tabela `omie_sync_cursors`
- Identity resolution: + telefone normalizado como 4o fallback
- **Fase A**: matching expandido (email → CNPJ → telefone) + `omie_tipo_pessoa`, `omie_razao_social`, `omie_segmento`
- **Fase E (nova)**: `ListarContasReceber` paginado → upsert `omie_parcelas` via `omie_titulo_id`
- **Fase F (nova)**: `ListarNF` paginado → `deal_items` com `source='omie_nfe'`, `proposal_id:'omie-direct'`
- **Fase B**: simplificada — apenas frete (deal_items de pedido usam `source='omie'`, nao conta para faturamento)
- Ordem: A → E → F → B → C → D → flush
- `enrichFromPedido`: reordenado (parcelas → items → frete → enrichLead)
- `marcarParcelaPaga`: chama `enrichLead` apos marcar
- Cobrancas: inclui `omie_score` e `omie_classificacao` no payload SellFlux
- Endpoints: `?action=enrich&lead_id=X`, `?action=reset`

## Etapa 3 — `useLeadErpData.ts`

- Select expandido com 17+ novos campos
- Interface expandida com tipos exatos (score labels, classificacao)
- Campos lidos do banco — score nunca calculado em TypeScript

## Etapa 4 — `ErpDataTab.tsx`

5 secoes novas APOS DualStatusBadge, ANTES das metricas existentes:
1. **Classificacao Operacional**: banner colorido com emoji + insight textual (PRIORIDADE/RECUPERACAO/REATIVACAO/ATIVO/MONITORAR)
2. **Score Omie**: barra 4 zonas + label + alerta inadimplente
3. **Resumo Financeiro**: grid 2x2 + barra de quitacao
4. **Comportamento de Compra**: ticket medio, NFs, ultima compra, dias sem comprar + insights automaticos
5. **Identidade ERP**: tipo pessoa, razao social, segmento

## Etapa 5 — `DualStatusBadge.tsx`

- Props: + `omieInadimplente?`, `omieClassificacao?`
- Bloco de alerta vermelho ANTES do alerta `real_status` quando inadimplente

## Etapa 6 — `FinanceiroBadge.tsx`

Substituicao completa. Dois badges separados:
- financeiroBadge: parcelas vencidas / proximo vencimento (sem mudanca logica)
- scoreBadge: label + numero colorido (PREMIUM/ATIVO/OPORTUNIDADE/RISCO)

## Arquivos

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar |
| `supabase/functions/omie-lead-enricher/index.ts` | Substituir |
| `src/hooks/useLeadErpData.ts` | Editar |
| `src/components/leads/tabs/ErpDataTab.tsx` | Editar |
| `src/components/leads/DualStatusBadge.tsx` | Editar |
| `src/components/leads/FinanceiroBadge.tsx` | Substituir |

