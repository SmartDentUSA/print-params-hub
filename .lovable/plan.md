# Gate -1 — próximos passos (aguardando aprovação humana)

Este plano é a proposta de execução do Gate -1 baseada no relatório de pré-verificação já entregue. **Nada aqui roda sem aprovação explícita.**

## Contexto

O relatório de pré-verificação confirmou dois P0 estruturais (código/schema) e não pôde confirmar histórico de invocações porque a retenção de logs acessível a esta sessão é de <10 min. Ação de revogação/rotação/desligamento não depende da contagem histórica para ser correta — depende só da superfície de risco atual.

## Ações propostas (ordem)

### Passo 1 — Rotação de `PIPERUN_API_KEY` (obrigatório, primeiro)
1. Gerar nova chave no dashboard PipeRun.
2. Atualizar secret no Supabase (`update_secret PIPERUN_API_KEY`).
3. Aguardar propagação (edge functions relêem a env em cold start).
4. Confirmar smoke test em `piperun-list-pipelines` (GET) — se responder 200, propagação OK.

Motivo: a chave antiga foi loggada em URL (`piperun-api-test` linhas 63/82–91). Trata como comprometida.

### Passo 2 — Contenção de `piperun-api-test`
Opção A (recomendada): marcar `enabled = false` em `supabase/config.toml` para a função, redeploy automático.
Opção B: setar `verify_jwt = true` (fecha para anon mas mantém acessível a admin logado). Como só é usado em diagnóstico manual, A é mais simples.

### Passo 3 — Contenção de `execute_agent_sql`
Migration única:
```sql
REVOKE EXECUTE ON FUNCTION public.execute_agent_sql(text) FROM PUBLIC, anon, authenticated;
-- service_role já tem por ser owner de tabelas / superuser da API; manter para não quebrar chamadas server-side eventuais
ALTER FUNCTION public.execute_agent_sql(text) SET search_path = public;
```
Após revogar, monitorar por 24h se algo do produto quebra (esperado: nada, dado que não há caller no repo). Se sim, decidir: `GRANT` cirúrgico para role específico ou refatorar caller para não usar SQL-como-texto.

### Passo 4 — Desabilitar `trg_auto_dedup_phone` (opcional, sem urgência)
Trigger parou de emitir merges em jun/2026. Amostragem de 10 casos anteriores não mostrou merge de pessoas distintas. Proposta: **manter ligado**, mas ampliar amostra para 50 casos (queries de leitura) antes de decidir. Nada a fazer no Gate -1.

## Não faz parte deste gate
- Nenhuma limpeza de `merged_into` autorreferenciado.
- Nenhum backfill de identidade.
- Nenhuma mudança em `smart-ops-lia-assign`, Cérebro Copilot, Golden Rule.
- Nenhuma migração de dado.

## Critério de sucesso
- Nova `PIPERUN_API_KEY` ativa; edge functions PipeRun funcionando (verificado por 1 GET).
- `piperun-api-test` retorna 404/desligado.
- `execute_agent_sql` retorna erro de permissão para anon/authenticated.
- Nenhum error rate novo em `system_health_logs` nas 2h seguintes.

## Rollback
- Rotação de chave: manter a antiga válida no PipeRun por 24h antes de revogá-la lá.
- `piperun-api-test`: reverter `enabled` no config.toml.
- Grants em `execute_agent_sql`: `GRANT EXECUTE ... TO authenticated` (reverso do REVOKE).
