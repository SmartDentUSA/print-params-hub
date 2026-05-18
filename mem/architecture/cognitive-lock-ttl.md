---
name: Cognitive Analysis Lock (TTL row-based)
description: TTL row-based lock para isolar cognitive-lead-analysis de turnos concorrentes — substitui advisory lock por incompatibilidade com pgBouncer
type: feature
---
**Tabela**: `cognitive_lead_locks` (lead_id PK, locked_at, ttl_seconds=30).

**RPCs (service_role only)**:
- `try_lock_cognitive_analysis(uuid)` — INSERT … ON CONFLICT DO UPDATE WHERE locked_at < now() - ttl. Retorna `FOUND`.
- `release_cognitive_analysis_lock(uuid)` — DELETE.
- `cleanup_orphan_cognitive_locks()` — DELETE WHERE locked_at < now()-5min. Para pg_cron opcional.

**Por que row-based:** advisory locks (`pg_advisory_lock`) ficam atrelados à sessão Postgres e não sobrevivem ao pool transação do PostgREST/pgBouncer — o `release` cai numa conexão diferente e falha silenciosamente.

**Uso em `cognitive-lead-analysis`**: try/finally — `lockedLeadId` setado após aquisição bem-sucedida; finally chama `release_cognitive_analysis_lock` para evitar segurar lock até TTL expirar. Contenção registra `system_health_logs(event_type='cog_lock_skipped')` e retorna 202.
