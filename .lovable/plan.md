## Diagnóstico (4 bugs distintos, todos comprovados no banco)

### Bug 1 — Lista NÃO filtra leads mergeados
`src/components/SmartOpsLeadsList.tsx` linha 494: `from("lia_attendances").select("*")` sem `merged_into IS NULL`.

**Impacto**: **702 leads mergeados poluem a lista** (consulta confirmou). Heitor Rabeti aparece como "0 deals" porque foi mergeado em `f65fd9a6-757d-4168-b1ce-f50f4bfd014a` (Heitor Rabetti canonical, que tem 3 deals e `piperun_id 59687015`). Quem clica vê o lead órfão sem dados.

Viola a regra Core: "ALL queries to `lia_attendances` MUST include `WHERE merged_into IS NULL`".

### Bug 2 — Contador "X deals" só conta GANHAS
`supabase/functions/smart-ops-leads-api/index.ts` linhas 117-121:
```ts
const wonDeals = allDealsList.filter((d) => WON_STATUSES.includes(d.status));
lead.total_deals = wonDeals.length;
```
E `SmartOpsLeadsList.tsx` linha 361 imprime `lead.total_deals`.

**Resultado**: lead com 1 oportunidade aberta em "Negociação" → "0 deals". Lead com 3 propostas perdidas → "0 deals". Só leads com venda concretizada exibem número >0.

Viola memória `[Total Deals Count]`: "`total_deals_all` counts all deals across history, not just won". A lista USA a coluna `total_deals` (recalculada no detail) e nunca lê `total_deals_all`.

Confirmado nos dados: Vitor (`piperun_status:0` "Sem contato") tem 2 ganhas no JSONB → exibe 2. Leandro tem 1 deal aberto em "Negociação" → exibe 1 porque o contador da lista vem da coluna `total_deals` desatualizada (`piperun_status:0`, não ganha). Já leads recém-criados com 1 deal aberto que nunca tiveram recompute exibem 0.

### Bug 3 — Lead WhatsApp sem identidade ainda existe
`019ebe53-f0b3-4a98-8ac9-4ed65ccd388b` (`217071992459498@lid` / `wa_*@whatsapp.lead`): foi criado **antes** do `lead-identity-guard` que você implementou na sessão anterior. O guard bloqueia novos, mas não limpa os 174 phantoms já existentes.

### Bug 4 — 1.139 leads canonical sem `piperun_id`
Ruani, Bernadete, Hugo, Otávio, Paulo, Caio, Juliana, Marco, Lucas, Gideon, Felipe, Ana Paula, Flavia, Fabiano, Marcos, Andrea, Mitiko, Johnny, Felippe, Tamára, Paulo Eduardo etc. — todos têm `piperun_id IS NULL`, `pessoa_piperun_id IS NULL`, `piperun_updated_at IS NULL`. Nunca foram criados no PipeRun (ou criação falhou silenciosamente). Por isso 0 deals, e seguirão 0 enquanto não forem ressincronizados.

Diferente do Bug 3, esses **têm nome+email reais** então passam no `lead-identity-guard` e devem ser retentados via `smart-ops-piperun-retry-failed-leads`.

### Bonus — 9 leads com `total_deals > 0` e `piperun_deals_history` vazio
Divergência clássica de contador. Será corrigido pelo mesmo recompute do Bug 2.

## Plano de correção

### Parte A — Lista (frontend, deploy imediato)
Em `src/components/SmartOpsLeadsList.tsx`:

1. Adicionar `.is("merged_into", null)` em `fetchLeads` (linha ~497) e em **todos** os `select` de filtros agregados (linhas 454-458).
2. Trocar `lead.total_deals || 0` (linha 361) por uma contagem feita no próprio cliente a partir de `piperun_deals_history` (length total, não só ganhas), com fallback para `total_deals_all || total_deals || 0`.
3. Adicionar `total_deals_all` ao tipo `LeadFull` (linha ~143).

### Parte B — Endpoint detail (`smart-ops-leads-api`)
Em `handleDetail`:
1. Computar `total_deals_all = allDealsList.length` (todas as oportunidades).
2. Manter `total_deals = wonDeals.length` (semântica de "vendas fechadas") mas RENOMEAR no payload para `total_won_deals` para clareza.
3. Persistir ambos via `update` no banco (assim a lista que lê coluna fica correta sem precisar de recompute).

### Parte C — Migration de limpeza (idempotente)
1. **Recompute global** dos contadores em `lia_attendances`:
   - `total_deals_all = jsonb_array_length(piperun_deals_history)` para leads canonical.
   - `total_deals = (count de status IN ('ganha','won','Ganha'))`.
2. **Soft-archive dos 174 leads phantom WhatsApp** (`email LIKE 'wa_%@whatsapp.lead'` AND `nome ~ '^[0-9]+@lid$'` AND `piperun_id IS NULL`): marcar `merged_into = id` (auto-merge para não aparecer) + flag em coluna nova `archived_reason='missing_identity'` (já que `merged_into` aceita o próprio id como tombstone) — ou criar coluna `archived_at`. Decisão de implementação no momento.
3. Adicionar índice parcial `lia_attendances_canonical_idx ON (created_at DESC) WHERE merged_into IS NULL` para acelerar a lista.

### Parte D — Retry dos 1.139 sem `piperun_id`
1. Criar/ajustar endpoint `smart-ops-piperun-create-missing` (ou estender `smart-ops-piperun-retry-failed-leads`) que:
   - Lista canonical leads sem `piperun_id` que passam no `validateLeadIdentity` (têm nome+email+telefone).
   - Cria pessoa+deal no PipeRun e grava `piperun_id`/`pessoa_piperun_id`.
   - Pacing 300ms, lote configurável (`limit`, `dry_run`).
2. Disparar uma execução inicial com `dry_run` para o usuário ver quantos serão criados antes do real.

### Parte E — Validação pós-deploy
1. `SELECT count(*) FROM lia_attendances WHERE merged_into IS NULL` — número esperado: `total - 702 - 174` ≈ baseline.
2. Conferir Heitor Rabeti: o lead órfão não aparece mais; o canonical mostra "3 deals".
3. Conferir Leandro Arruda: card mostra "1 deal" (1 aberto em Negociação) com `total_deals_all=1`.
4. Vitor Spada: mantém "2 deals" (ganhas) ou passa a refletir total real do JSONB (a definir na Pergunta 1 abaixo).

## Arquivos alterados

- `src/components/SmartOpsLeadsList.tsx` — filtro `merged_into IS NULL` + contador correto.
- `supabase/functions/smart-ops-leads-api/index.ts` — `total_deals_all` + persistência dos contadores.
- `supabase/functions/smart-ops-piperun-create-missing/index.ts` (novo, ou extensão de `retry-failed-leads`).
- Migration: recompute + soft-archive phantoms + índice parcial.

## Perguntas

1. **Semântica do "X deals" no card**: você quer que mostre **(a) total de oportunidades** (abertas+ganhas+perdidas, casa com a coluna `total_deals_all`) ou **(b) só vendas fechadas**? Eu recomendo (a) com badge separado para ganhas, porque hoje "0 deals" engana o vendedor.
2. **Phantoms WhatsApp (174 leads)**: posso soft-archive automaticamente (some da lista, fica auditável)? Ou você quer hard-delete?
3. **Retry dos 1.139 sem piperun_id**: rodo já com `dry_run=true` para você revisar o relatório antes de criar de verdade no PipeRun?