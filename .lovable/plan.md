

# Plano: Enriquecimento Financeiro Omie — 6 Etapas

## Estado Atual Verificado

| Item | Status |
|------|--------|
| `real_status` GENERATED | Existe — SEM `omie_inadimplente` (precisa DROP+recreate) |
| `telefone_normalized` | Existe em `lia_attendances` |
| `fn_atualizar_parcelas_vencidas` | Existe no banco |
| `idx_parcelas_titulo_id` | Existe mas NAO eh UNIQUE (precisa recrear como UNIQUE) |
| 17 colunas financeiras | NAO existem (precisam ser criadas) |
| `deal_items.proposal_id` | Existe — codigo atual ja usa `'omie-direct'` |
| `deal_items` | NAO tem `created_at` — tem `synced_at` (confirmado) |

---

## Etapa 1 — Migration SQL

Uma unica migration com 5 blocos:

**Bloco 1**: ADD 17 colunas em `lia_attendances`:
- `omie_faturamento_total`, `omie_valor_pago`, `omie_valor_em_aberto`, `omie_valor_vencido` (NUMERIC DEFAULT 0)
- `omie_percentual_pago`, `omie_ticket_medio` (NUMERIC DEFAULT 0)
- `omie_frequencia_compra`, `omie_total_pedidos` (INTEGER DEFAULT 0)
- `omie_ultima_compra`, `omie_ultima_nf_emitida` (DATE)
- `omie_dias_sem_comprar`, `omie_dias_atraso_max` (INTEGER DEFAULT 0)
- `omie_inadimplente` (BOOLEAN DEFAULT false)
- `omie_score` (INTEGER DEFAULT 0)
- `omie_tipo_pessoa`, `omie_segmento`, `omie_razao_social` (TEXT)
- 2 indexes: `idx_lia_omie_score`, `idx_lia_omie_inadimplente`

**Bloco 2**: DROP + recreate `real_status` com `omie_inadimplente` (sem subquery):
```sql
ALTER TABLE lia_attendances DROP COLUMN IF EXISTS real_status;
ALTER TABLE lia_attendances ADD COLUMN real_status text GENERATED ALWAYS AS (
  CASE
    WHEN omie_inadimplente = true AND erp_status NOT IN ('CANCELADO','DEVOLVIDO') THEN 'INADIMPLENTE'
    WHEN frete_status IN ('DEVOLVIDO','EXTRAVIADO') THEN 'DEAL_PERDIDO'
    -- ... (mesma logica do spec)
  END
) STORED;
```

**Bloco 3**: `fn_omie_score_label(score)` — retorna PREMIUM/ATIVO/OPORTUNIDADE/RISCO

**Bloco 4**: `fn_enrich_lead_from_omie(p_lead_id)` — recalcula todos os campos financeiros de `omie_parcelas` + `deal_items`, incluindo `ltv_total = v_fat_total`

**Bloco 5**: Recrear index `idx_parcelas_titulo_id` como UNIQUE:
```sql
DROP INDEX IF EXISTS idx_parcelas_titulo_id;
CREATE UNIQUE INDEX idx_omie_parcelas_titulo_id ON omie_parcelas(omie_titulo_id) WHERE omie_titulo_id IS NOT NULL;
```

## Etapa 2 — Edge Function `omie-lead-enricher/index.ts`

Substituicao completa (~1100 linhas). Mudancas sobre o codigo atual (731 linhas):

- **`enrichLead()`**: nova funcao helper que chama `fn_enrich_lead_from_omie` + `calculate_lead_intelligence_score`
- **Identity resolution**: adiciona fallback por `telefone_normalized` (4o nivel)
- **Fase A expandida**: preenche `omie_tipo_pessoa`, `omie_razao_social`, `omie_segmento` + matching por CNPJ e telefone
- **Fase E (nova)**: `ListarContasReceber` paginado → upsert `omie_parcelas` via `omie_titulo_id` (UNIQUE index)
- **Fase F (nova)**: `ListarNF` paginado → `deal_items` com `source='omie_nfe'`, `proposal_id:'omie-direct'`, `synced_at`
- **Recalculo final**: Set de leads tocados, `enrichLead()` para cada
- **Endpoint `?action=enrich&lead_id=X`**: recalcula um lead especifico
- **Webhooks**: todos chamam `enrichLead()` apos modificar dados
- **Cobrancas**: inclui `omie_score` no payload SellFlux

## Etapa 3 — `useLeadErpData.ts`

- Expandir select com 17 novos campos
- Expandir interface `LeadErpSummary` com campos tipados
- Calcular `omieScoreLabel` no hook
- Return com todos os novos campos mapeados

## Etapa 4 — `ErpDataTab.tsx`

4 secoes novas APOS DualStatusBadge, ANTES das metricas existentes:
- **Score Omie**: barra de progresso colorida + label + alerta inadimplente
- **Resumo Financeiro ERP**: grid 2x2 (faturamento, pago, aberto, % quitado)
- **Comportamento de Compra**: ticket medio, pedidos, NFs, ultima compra, dias sem comprar
- **Identidade ERP**: tipo pessoa, razao social, segmento

## Etapa 5 — `DualStatusBadge.tsx`

- Nova prop `omieInadimplente?: boolean`
- Bloco de alerta vermelho condicional quando `omieInadimplente && !compact`

## Etapa 6 — `FinanceiroBadge.tsx`

- Props expandidas: `omieScore?`, `omieScoreLabel?`
- Score badge ao lado do badge financeiro quando disponivel

---

## Arquivos

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar (5 blocos) |
| `supabase/functions/omie-lead-enricher/index.ts` | Substituir (~731 → ~1100 linhas) |
| `src/hooks/useLeadErpData.ts` | Editar |
| `src/components/leads/tabs/ErpDataTab.tsx` | Editar |
| `src/components/leads/DualStatusBadge.tsx` | Editar |
| `src/components/leads/FinanceiroBadge.tsx` | Substituir |

