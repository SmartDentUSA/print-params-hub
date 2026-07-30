# 2026-07-30 — Unificação "Post → Grupos" + auditoria de duplicidade de envio

## Parte 1 — Fluxo Post → Grupos WhatsApp (executado)

| Item | Ação |
|---|---|
| `trg_social_post_to_wa` + `fn_social_post_to_wa_campaign()` (Peça A, morta) | **Removidos** via migration |
| Cron job 141 `social-post-group-dispatch-1h` (Peça B, inerte) | **Desagendado** |
| Edge function órfã `social-post-group-dispatch` | **Pendente**: não existe no repo, precisa ser removida pelo dashboard. Não foi possível exportar o código-fonte (não há API de download de source disponível ao agente) — backup não gerado |
| `PostGruposHistory.tsx` | Reapontado de `wa_group_dispatch_log` (morta desde 07/jul) para `wa_group_sent_fingerprints` + join em `wa_campaigns` (nome, status, nº de envios, último envio) |

Fluxo canônico único mantido: `social-post-auto-blast` → `wa-group-blast` → `wa-dispatcher`.

## Parte 2 — Auditoria de duplicidade (investigação; sem alteração de schema)

| Tabela | Proteção hoje | Status real | Achado / recomendação |
|---|---|---|---|
| `wa_message_queue` | `uq_..._campaign_group_node` (parcial: `node_id` nullable) | **Ativa** (374 linhas, último 30/jul) | 36 linhas com `node_id NULL` são **todas legado** (29/mai a 06/jul). Escritores atuais: `wa-campaign-builder` (node_id determinístico, ok) e `wa-group-blast` (usava `crypto.randomUUID()` → constraint nunca disparava). **Corrigido no código**: `node_id = blast:<content_hash>:<type>:0`. `SET NOT NULL` fica pendente da sua confirmação (exige limpar/backfill das 36 legadas) |
| `whatsapp_send_queue` | só PK | **Legado/inativa** — 6 linhas, última em 27/mai/2026 | Escrita só via RPC `fn_enqueue_whatsapp`; nenhum código do repo (edge functions ou front) chama a RPC ou a tabela. Recomendação: **arquivar/depreciar** em vez de criar constraint. Se reativar: `UNIQUE(team_member_id, to_phone, trigger_source, automation_rule_id)` |
| `wa_followup_queue` | PK + FK `lead_id` | **Morta** — 0 linhas, nenhum escritor no repo nem em função do banco | Recomendação: **dropar** ou, se reativar, `UNIQUE(lead_id, sdr_etapa)` (a linha é por etapa de follow-up do SDR) |
| `wa_send_log` | só PK | **Ativa** (905 linhas, último 30/jul) | É **apenas log de auditoria** pós-envio: escrito pelo `wa-dispatcher` depois do POST na Evolution; nenhuma decisão de dedupe lê essa tabela (dedupe usa `wa_message_queue.status` e `wa_group_sent_fingerprints`). **Não precisa de constraint** |
| `email_sequence_dispatches` | 2 constraints UNIQUE idênticas em `(sequence_id, step_id, lead_id)` | Ativa | Redundância confirmada. Remoção de `email_sequence_dispatches_unique_step` **pendente da sua confirmação** |
| `campaign_send_log` | `UNIQUE(campaign_id, lead_id)` | Ativa | Constraint correta (ver ressalva de ordem abaixo) |

### 2.7 Padrão "insert antes de enviar" — riscos conhecidos

- **`wa-group-blast` → `wa-dispatcher`**: correto. A linha de fila é inserida antes; o envio só ocorre ao consumir a fila, e a fingerprint (`wa_group_sent_fingerprints`) é checada antes de enfileirar.
- **`wa-dispatcher`**: o `wa_send_log` e o `status='sent'` são gravados **depois** do POST na Evolution. Risco residual conhecido: se o processo morrer entre o POST e o update, o item volta a `pending` e pode reenviar. Mitigado (não eliminado) pelo `evo_message_id` usado no `wa-delivery-reconciler`.
- **`wa-broadcast-dispatch`** (1:1 por lead): **envia primeiro, contabiliza depois** e não grava linha de controle por lead — nenhuma constraint protege reenvio se a função for reexecutada para o mesmo broadcast. Risco documentado; correção fora do escopo desta tarefa (contrato não pode mudar sem aprovação).
- **`email_sequence_dispatches`**: claim atômico via `claim_email_sequence_dispatch` (insert-then-send) — correto.

## Pendências aguardando sua confirmação

1. `ALTER TABLE wa_message_queue ALTER COLUMN node_id SET NOT NULL` (após tratar as 36 linhas legadas).
2. `DROP CONSTRAINT email_sequence_dispatches_unique_step`.
3. Drop/depreciação de `whatsapp_send_queue` e `wa_followup_queue`.
4. Remoção manual da edge function `social-post-group-dispatch` no dashboard Supabase.

Commit/PR: gerado por esta alteração no branch atual do projeto Lovable.

---

## Fechamento — 30/jul/2026

Migration aplicada: `supabase/migrations/20260730032351_ef1da6c8-33ec-43cf-a9c3-9d58835f56ac.sql`

| # | Alteração | Detalhe |
|---|---|---|
| 1 | `wa_message_queue.node_id` → `NOT NULL` | **Ressalva:** `SET NOT NULL` valida linhas existentes (não é só para inserts novos). As 36 linhas legado (29/mai–06/jul) receberam backfill determinístico `node_id = 'legacy:' || id` antes do `ALTER`. Nenhuma linha nova desde 06/jul tinha `node_id` nulo — a correção do `wa-group-blast` (`blast:<content_hash>:<type>:0`) está segurando |
| 2 | `DROP TABLE wa_followup_queue` | Estrutura morta (0 linhas, 0 escritores). Se reativar no futuro: tabela nova, já nascendo com `UNIQUE(lead_id, sdr_etapa)` |
| 3 | `DROP CONSTRAINT email_sequence_dispatches_unique_step` | Mantida a canônica `email_sequence_dispatches_sequence_id_step_id_lead_id_key`. Dedupe funcional inalterado |

`whatsapp_send_queue`: **nenhuma alteração de schema** nesta rodada. Status registrado: legado, sem uso ativo (6 linhas, última 27/mai/2026, único escritor `fn_enqueue_whatsapp`, sem chamadores).

### Edge function órfã `social-post-group-dispatch`

Autorizada a remoção pelo dashboard Supabase (Functions → `social-post-group-dispatch` → Delete). **Código-fonte não recuperável (sem API de export); function removida sem backup em 30/jul/2026.** Confirmada inerte desde 03–07/jul (zero efeito observável, zero campanhas geradas).

### Risco conhecido — NÃO resolvido nesta rodada

`wa-dispatcher` e `wa-broadcast-dispatch` gravam o registro de controle **depois** do envio externo (Evolution), e não antes. Se o processo morrer entre o POST e a gravação, existe janela de reenvio. Fica para uma rodada própria, por tocar infraestrutura compartilhada com campanhas manuais de marketing. **Nada foi alterado nessas duas funções.**

## Adendo — 30/jul/2026 (auditoria de timestamps + filtro de plataforma)

### Contradição do `platforms` do grupo "Dashboard - SMDT - Diária" — RESOLVIDA
- Linha `a0bb516f-cf9b-4bb6-9942-a55f53ab379f`: `platforms=['instagram']`, `updated_at = created_at = 2026-07-06 22:11:54` (idênticos).
- `post_group_targets` **não tinha** trigger de `updated_at` (confirmado: zero triggers em `pg_trigger`), e o frontend (`PostGruposInstanceCard.updatePlatforms`) faz `.update({ platforms })` **sem** enviar `updated_at`. Resultado: timestamp congelado na criação.
- Prova de que a alteração é recente: `xmin` dessa linha = **59317890** = `max(xmin)` de toda a tabela (383 linhas). Ou seja, é a transação **mais recente** que tocou `post_group_targets` — muito depois das linhas criadas em 07/jul (xmin ~43.98M). O valor `['instagram']` foi gravado recentemente, quase certamente pelo clique no checkbox durante esta conversa.
- **Não existe log de mudança**: sem audit table para essa tabela, sem pgaudit habilitado, sem log de aplicação no frontend. Não é possível identificar o autor exato — só a ordem relativa via `xmin`.

### Reavaliação do item 1 do diagnóstico anterior
A conclusão "Dashboard tinha `platforms=['instagram']` desde 06/jul e mesmo assim recebeu posts de Facebook em 28-29/jul, logo o filtro era ignorado" **não se sustenta**. A evidência do `xmin` indica que em 28-29/jul o grupo estava com `platforms=[]` (sem restrição) e recebeu Facebook corretamente. Não há evidência de bug "filtro salvo e ignorado" — o filtro nunca foi exercitado em produção. Item 1 rebaixado de "bug confirmado" para **"não comprovado / provável comportamento correto"**.

### Correções aplicadas
1. Migration: função `public.set_updated_at()` + triggers `BEFORE UPDATE` em `post_group_targets` e `post_group_instance_config` (esta última tinha a mesma exposição).
2. `wa-group-blast`: passa a aceitar `platform` opcional e revalidar contra `post_group_targets.platforms` (defesa em profundidade; `platforms=[]` = sem restrição). Retorna `409 platform_filtered` se nenhum grupo aceitar. `social-post-auto-blast` agora envia `platform` em cada chamada.
3. `PlatformPicker`: exibe apenas redes com posts existentes em `social_posts` (hoje instagram/facebook/tiktok/youtube); redes já selecionadas continuam visíveis para desmarcar.

### Pendente (bloqueado por decisão do usuário)
- Teste controlado com post real (item **a**) — segurado.
