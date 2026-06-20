## Sentinela — Inteligência de Mercado a partir dos Grupos WA

Implementação fiel ao briefing `LOVABLE_SENTINELA_SPEC.md`. Captura mensagens dos 301 grupos da instância **Danilo Henrique**, classifica com IA em batch e mostra insights acionáveis em uma nova sub-aba em SmartOps → Inteligência.

### Premissas que vou respeitar
- Não alterar `evolution_api_key`/`evolution_instance_name` em `team_members`.
- Não tocar webhooks/EFs existentes da `Danilo Henrique` (briefings vendedores, Pipeline A) — apenas adicionar `sentinela-webhook-receiver` como destino adicional.
- Não tocar `cs_principal` nem `Dra. Lia` — Sentinela é só leitura de grupos do Danilo.
- Toda nova EF de envio respeita `system_config.evolution_blocked_instances`.
- `LeadDetailPanel.tsx`, `lead_activity_log` e integrações PipeRun/Sellflux/Meta ficam intactos.

### Banco (1 migração)
1. `sentinela_group_messages` (campos exatamente como spec 2.4), com índices `group_id`, `message_ts DESC`, parcial `processed=false`, parcial `buy_signals=true`. RLS + GRANTs.
2. `sentinela_insights` (spec 2.4).
3. `sentinela_config` (spec 2.4), seed com toggle on para os 10 grupos prioritários e prioridade `high`.
4. RLS via `has_role(auth.uid(), 'admin'|'cs'|'vendedor')`:
   - `sentinela_group_messages`: SELECT só `admin`/`cs`. Insert via service_role (EF).
   - `sentinela_insights`: SELECT `admin`/`cs`/`vendedor`.
   - `sentinela_config`: SELECT auth, UPDATE/INSERT só `admin`.
5. GRANTs explícitos para `authenticated` e `service_role` em todas as tabelas (regra Public Schema Grants).

### Edge Functions (3 novas)
1. **`sentinela-webhook-receiver`** — `verify_jwt=false`. Recebe `MESSAGES_UPSERT` da Evolution. Valida assinatura no mesmo padrão dos outros webhooks Evolution (`apikey` da instância Danilo lido de `team_members`). Filtra `remoteJid LIKE '%@g.us'`, descarta `fromMe`, dedup por `(instance, message_id)`. Liga `wa_groups` por `group_jid`, resolve `lead_id` via `wa_lid_phone_map`/`lia_attendances.phone` quando possível. Loga em `system_health_logs` (`source='sentinela'`).
2. **`sentinela-analyzer`** — cron a cada 6h + invocável por botão "Analisar Agora". Pega lotes de 50 mensagens `processed=false`, agrupa por `group_id`, chama Lovable AI Gateway (DeepSeek) com prompt de spec 2.5 (contexto: produtos Smart Dent + concorrentes). Atualiza colunas de classificação + `relevance_score`. Quando detectar padrões fortes em janela do lote, grava `sentinela_insights` (`momentum|atrito|competitivo|oportunidade|tendencia`) com `supporting_msgs`.
3. **`sentinela-daily-report`** — cron 07:00 BRT. Consolida últimas 24h em insight `momentum`, monta resumo markdown e envia via `sendWa` instância `Danilo Henrique` → `5519992612348`. Antes de enviar verifica `evolution_blocked_instances`.

Cron via `pg_cron` ou Supabase Scheduled Functions, padrão do projeto.

### Configuração do webhook Evolution
Sem sobrescrever o webhook existente do Danilo: registrar via `webhook_by_events=true` apontando o evento `MESSAGES_UPSERT` para `sentinela-webhook-receiver`. Vou inspecionar primeiro o que já está configurado e, se necessário, fazer o handler atual da Danilo encaminhar (fire-and-forget) para Sentinela. **Não rodo a configuração automática** — entrego um botão "Conectar webhook" na sub-aba Configuração que faz a chamada autenticada para a Evolution.

### Frontend — `SmartOps → Inteligência → 🛡️ Sentinela`
Localizar a tab "Inteligência" existente (vou achar a montagem real ao entrar em build) e adicionar `SentinelaTab` com sub-abas:
- **Momentum** — KPIs (24h/7d/30d), Recharts line de volume+sentimento, top tópicos/produtos, donut sentimento.
- **Sinais de Compra** — feed realtime (`buy_signals=true`), badges urgência, botão "Criar Lead" (modal já reaproveitável do CRM).
- **Pontos de Atrito** — agrupado por categoria, severidade, campo "Ação tomada" que marca `reviewed=true`.
- **Intel Competitiva** — barras por concorrente, alertas de pico 24h, timeline.
- **Ações Preditivas** — cards de `insight_type IN ('oportunidade','tendencia')`.
- **Configuração** — toggles por grupo, prioridade, tópicos de foco, status do webhook, botão "Conectar webhook", botão "Analisar Agora".

Reuso total: cards KPI, Recharts, badges de status, seletor de período já existentes no SmartOps. Sem novos componentes base.

### Restrições de exibição
Mensagens cruas só aparecem para `admin`/`cs`. Vendedor vê apenas insights agregados (RLS já impede acesso à tabela bruta).

### Fora de escopo
- Captura de grupos de `cs_principal` ou `Dra. Lia`.
- Resposta automática nos grupos.
- Migração retroativa de mensagens antigas (`whatsapp_inbox`) — Sentinela começa do zero a partir do webhook.

### Riscos
- Volume: 3-15k msgs/dia × payload jsonb cabe folgado, mas IA em lote precisa ser idempotente — vou usar `ai_batch_id` + `FOR UPDATE SKIP LOCKED` na seleção.
- Webhook existente Danilo: antes de qualquer mudança no endpoint dele, leio o estado atual via GET na Evolution e confirmo com você se precisar de coabitação.

Aprova para eu construir?
