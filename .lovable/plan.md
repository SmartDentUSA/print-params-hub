
# Plano: recuperar leads + nunca mais perder

## Parte 1 — Correção imediata (8 leads do CSV)

### 1a. Ingerir 4 leads ausentes
Estão no PipeRun (vieram pela integração nativa PipeRun↔Meta) mas nunca chegaram ao nosso CDP.

| Lead | Telefone | Form |
|------|----------|------|
| benhurlanna@yahoo.com | +553184028095 | GlazeON |
| evelynbarra@gmail.com | +5511942501031 | GlazeON |
| jeffersondelcarlo@gmail.com | +5511984410064 | GlazeON |
| poliana2lopes@gmail.com | +556299980101 | Impresoras |

**Ação:** invocar `smart-ops-sync-piperun?pipeline_id=18784&since=2026-05-23` (Funil de Vendas, janela 72h). O sync já tem `insert` em `lia_attendances` (linha 637) → vai criar os 4 com `piperun_id` correto, snapshot completo do deal e `funil_entrada_crm='Funil de vendas'`.

### 1b. Reabrir 4 reincidentes presos em "Estagnados"
| Lead | Deal antigo |
|------|-------------|
| andrefmastermind@gmail.com | 56441081 |
| ricardochinen64@gmail.com | 38218921 |
| fernandobrasil75@hotmail.com | 58674961 |
| elopes710.el@gmail.com | 47902052 |

PipeRun já tem deal novo "Em análise" pra cada um (CSV confirma). O `sync-piperun-vendas-1h` ao rodar com `since` recente vai puxar esses deals novos e o `pickPrimaryDeal` (open > closed) substitui o snapshot → eles passam pra "Funil de vendas" automaticamente. Mesma chamada do 1a resolve.

---

## Parte 2 — Solução permanente (blindagem)

### Causa-raiz dos 4 perdidos
- **Não vieram pelo nosso `meta-lead-ads-pull`**: ad account/page fora do escopo monitorado OU forms GlazeON sem `form_id` cadastrado.
- **Sync PipeRun usa filtro `updated_since`**: se entre 2 execuções o deal foi criado E movido sem batida com nossa janela, escapa.
- **Sem watchdog reativo**: hoje só temos `watchdog-leads-orfaos` semanal (segunda 11h) — perda fica invisível por até 7 dias.

### Defesa em 3 camadas

**Camada 1 — Webhook PipeRun como source-of-truth (preventivo)**
`smart-ops-piperun-webhook` já existe. Verificar no painel PipeRun se eventos `deal.created` / `person.created` do **Funil de Vendas (18784)** estão ativos e apontando pra nossa URL. Se sim → confirmar `system_health_logs` registra invocações. Se não → ativar. Isso captura todo deal novo em <5s.

**Camada 2 — Reconciliador diário CSV-style (detectivo)**
Nova edge function `smart-ops-piperun-funnel-reconciler` (rodar 1×/dia, 7h):
1. `GET /deals?pipeline_id=18784&updated_since=last_24h&show=200` (paginado)
2. Pra cada deal: `LEFT JOIN lia_attendances ON piperun_id = deal.id`
3. Se sem match → `INSERT` em `lia_attendances` com snapshot completo (mesma lógica do `sync-piperun` linha 637)
4. Se match em outro pipeline (Estagnados) → reaplica `pickPrimaryDeal` e atualiza snapshot
5. Loga `piperun_funnel_reconciler` com `inserted_count`, `refreshed_count`, `gap_emails[]` em `system_health_logs`

**Camada 3 — Alerta proativo (corretivo)**
Estender `watchdog-leads-orfaos` para rodar a cada 1h (não semanal) com query:
```sql
SELECT count(*) FROM piperun_deals_history pdh
LEFT JOIN lia_attendances l ON l.piperun_id = pdh.deal_id::text
WHERE pdh.pipeline_id=18784 
  AND pdh.created_at > now() - interval '6h'
  AND l.id IS NULL;
```
Se `count > 0` → INSERT em `system_health_logs` com `severity='critical'` + dispara WhatsApp pro admin via Evolution API.

---

## Arquivos a alterar

```text
supabase/functions/smart-ops-piperun-funnel-reconciler/index.ts   (NEW)
supabase/migrations/{ts}_piperun_reconciler_cron.sql              (NEW — cron job 1×/dia)
supabase/migrations/{ts}_watchdog_hourly.sql                      (NEW — reagenda watchdog 1h)
mem/architecture/piperun-funnel-reconciler.md                     (NEW — doc rule)
```

Nenhuma alteração em código de frontend. Nenhuma alteração no `sync-piperun` existente.

---

## Validação pós-deploy
1. Invocar reconciler manualmente — esperar 4 inserts + 4 refreshes.
2. Re-rodar a consulta de auditoria do CSV → todos os 30 com `piperun_pipeline_name='Funil de vendas'`.
3. Confirmar cron job ativo via `SELECT * FROM cron.job WHERE jobname LIKE '%reconciler%'`.
4. Inspecionar `system_health_logs WHERE function_name='piperun_funnel_reconciler'` próximas 24h.

Aprova pra implementar?
