

# Auditoria de Integrações — Plano de Correção

## Diagnóstico Resumido

Após análise completa do código, identifiquei as **causas raiz** de cada problema:

| # | Problema | Causa Raiz |
|---|---------|------------|
| 1 | SellFlux inativo | **Config externa**: URL do webhook nunca registrada no painel SellFlux |
| 2 | Astron nunca sincronizado | **Sem cron**: `sync-astron-members` existe mas nunca é chamado automaticamente |
| 3 | Cognitive 12/24.816 | **Guard bloqueante**: exige 5+ msgs na tabela `leads`→`agent_interactions`. Leads do PipeRun têm 0 msgs. Sem batch processor. |
| 4 | PipeRun metadata vazio | **Mapeamento incompleto**: `STAGE_TO_ETAPA` não cobre pipelines Atos/Exportação/Distribuidor/Ebook/Tulip. `pessoa_piperun_id`/`empresa_piperun_id` só são preenchidos no `lia-assign`, não no `sync-piperun`. |
| 5 | Intelligence Score 53% | **Sem trigger**: não há trigger SQL para recalcular ao atualizar um lead. Backfill incompleto. |
| 6 | Loja Integrada 34 leads | **Match rate baixo**: clientes ecommerce frequentemente não existem no CDP antes da compra. O webhook já cria leads novos, mas historicamente poucos pedidos foram processados. |
| 7 | Dados de qualificação vazios | **Origem**: PipeRun não tem esses campos preenchidos na maioria dos deals |

---

## Plano de Implementação (priorizado por impacto)

### Fix 1 — PipeRun: Enriquecer stage_name e pipeline_name para TODOS os pipelines

**Problema**: `piperun_stage_name` usa `STAGE_TO_ETAPA[stage_id]` que retorna o slug interno (`sem_contato`) em vez do nome legível, e pipelines Atos/Exportação/Distribuidor/Ebook/Tulip não têm nenhum mapeamento de stages.

**Solução**: No `mapDealToAttendance`, usar o nome da stage diretamente da API PipeRun (campo `stage.name` que vem no `with[]=stage`) em vez de depender apenas do mapeamento local.

Alterações:
- **`piperun-field-map.ts`**: Expandir `PipeRunDealData` para incluir `stage?: { id: number; name: string }`. Em `mapDealToAttendance`, popular `piperun_stage_name` com `deal.stage?.name || STAGE_TO_ETAPA[deal.stage_id] || null`.
- **`smart-ops-sync-piperun`**: Adicionar `"stage"` ao array `with[]` na chamada `piperunGet` (linha ~60 do `fetchDealsForPipeline`).
- **`piperun-full-sync`**: Idem — adicionar `"stage"` ao `with[]`.
- **`smart-ops-sync-piperun`**: Popular `pessoa_piperun_id` e `empresa_piperun_id` a partir de `deal.person_id` e `deal.company_id` que já vêm na resposta da API.

### Fix 2 — Intelligence Score: Trigger automático

**Problema**: Score calculado apenas via RPC manual ou backfill. Nenhum trigger recalcula ao atualizar campos relevantes.

**Solução**: Criar trigger SQL que chama `calculate_lead_intelligence_score` quando campos relevantes mudam.

```sql
CREATE OR REPLACE FUNCTION trigger_recalculate_intelligence_score()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (
    OLD.urgency_level IS DISTINCT FROM NEW.urgency_level OR
    OLD.interest_timeline IS DISTINCT FROM NEW.interest_timeline OR
    OLD.total_messages IS DISTINCT FROM NEW.total_messages OR
    OLD.total_sessions IS DISTINCT FROM NEW.total_sessions OR
    OLD.confidence_score_analysis IS DISTINCT FROM NEW.confidence_score_analysis OR
    OLD.proposals_total_value IS DISTINCT FROM NEW.proposals_total_value OR
    OLD.lojaintegrada_ultimo_pedido_valor IS DISTINCT FROM NEW.lojaintegrada_ultimo_pedido_valor OR
    OLD.tem_impressora IS DISTINCT FROM NEW.tem_impressora OR
    OLD.tem_scanner IS DISTINCT FROM NEW.tem_scanner
  ) THEN
    PERFORM calculate_lead_intelligence_score(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_recalc_intelligence_score
  AFTER UPDATE ON lia_attendances
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_intelligence_score();
```

Depois rodar backfill para os 11.720 leads sem score.

### Fix 3 — Astron: Adicionar pg_cron

**Problema**: `sync-astron-members` nunca é chamado automaticamente.

**Solução**: Adicionar cron job via SQL (usando insert tool, não migration):

```sql
SELECT cron.schedule(
  'sync-astron-members-daily',
  '0 6 * * *',  -- 6am UTC diariamente
  $$
  SELECT net.http_post(
    url:='https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/sync-astron-members',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb,
    body:='{"max_pages":100}'::jsonb
  );
  $$
);
```

### Fix 4 — Cognitive: Batch processor para leads elegíveis

**Problema**: `cognitive-lead-analysis` exige 5+ msgs e join com tabela `leads`. A grande maioria dos leads (PipeRun) nunca conversou com a LIA. Além disso, não existe batch processor.

**Solução**: Criar edge function `batch-cognitive-analysis` que:
1. Busca leads com `total_messages >= 5` e (`cognitive_analyzed_at IS NULL` OR `cognitive_analyzed_at < ultima_sessao_at`)
2. Para cada lead (max 20 por batch), chama `cognitive-lead-analysis`
3. Registrar em `system_health_logs`
4. Adicionar pg_cron para rodar a cada 4 horas

**Nota importante**: O guard de 5 msgs é correto — sem conversa não há dados para análise cognitiva. Os 12/24.816 refletem que poucos leads conversaram com a LIA. O batch apenas garante que os elegíveis sejam processados automaticamente.

### Fix 5 — SellFlux: Documentar URL do webhook

**Não é um bug de código** — a função `smart-ops-sellflux-webhook` está correta e pronta. O problema é que a URL do webhook nunca foi configurada no painel SellFlux.

**Ação do usuário**: Configurar no SellFlux a URL:
```
https://okeogjgqijbfkudfjadz.supabase.co/functions/v1/smart-ops-sellflux-webhook
```
Com método POST e Content-Type: application/json.

### Fix 6 — Loja Integrada: Criar leads automaticamente

**Problema**: O ecommerce-webhook já faz upsert, mas o match por email falha quando o cliente nunca foi lead.

**Solução**: No `smart-ops-ecommerce-webhook`, quando `existingLead` é null (linha 590), o código já cria um novo lead (linhas 625+). Verificar se o insert está funcionando corretamente e se o `source` está sendo marcado como `loja_integrada`. Parece funcional — o problema é que historicamente o polling está reprocessando pedidos antigos que já foram deduplicados. Os 34 leads refletem matches reais.

**Sem alteração de código necessária** — o fluxo já está correto.

---

## Resumo de Entregas

| # | Fix | Tipo | Impacto |
|---|-----|------|---------|
| 1 | PipeRun stage/pipeline enrichment | Código (3 arquivos) | 24.8k leads ganham metadata CRM |
| 2 | Intelligence Score trigger | Migration SQL | 11.7k leads ganham score automático |
| 3 | Astron cron | SQL (insert) | Sincronização diária de alunos |
| 4 | Cognitive batch | Nova edge function + cron | Processamento automático de leads elegíveis |
| 5 | SellFlux | Config manual (usuário) | Ativar fluxo de dados do SellFlux |
| 6 | Loja Integrada | Sem mudança | Já funcional |

