---
name: WhatsApp Dual Provider Router
description: Regra global — Evolution API para mensagens individuais, EvolutionGO para grupos, ativação por enabled+status por team_member, sem fallback automático
type: feature
---
Regra estrutural do SmartOps, aplicada a TODO `team_members` (nunca a um membro específico).

- **Evolution API normal** (`evolution_*`, :8080): mensagens individuais, atendimento, alertas, destinos `@s.whatsapp.net` e `@lid` em conversa individual.
- **EvolutionGO** (`evo_go_*`, :8081): grupos `@g.us`, mídias de grupo, sync/administração de grupos, participantes `@lid` dentro de grupo.

Ativação: `evolution_enabled` + `evolution_status='connected'` / `evo_go_enabled` + `evo_go_status='connected'` (+ credenciais). A mera existência de apikey/token NÃO é ativação. `*_last_check_at` guarda a última verificação (persistida pela UI de team_members ao consultar o status).

Router obrigatório: `supabase/functions/_shared/wa-provider-router.ts` (`resolveProvider(teamMember, operation)`, `operationForJid`, `requireConnectedEvolution(Go)`, `WaProviderBlockedError`).
- Modo dual (as duas conectadas) → separação estrita por função, **sem fallback automático** entre provedores; provedor caído bloqueia só as operações dele (fila grava `blocked_provider`, status `blocked_provider`).
- Modo legado (só uma habilitada) → comportamento anterior preservado.
- Proibido `useEvoGo = !!evoGoToken && !evolution_api_key` — removido de `wa-dispatcher`.
- Logs sempre com `team_member_id`, provider, instância e operação; nunca credenciais.