

## Resposta: Como os leads do PipeRun chegam à tabela `lia_attendances`

### Sim, mas com nuances importantes

Existem **dois caminhos** pelos quais leads do PipeRun entram na tabela `lia_attendances`:

---

### 1. Sync Periódico (`smart-ops-sync-piperun`)
- Roda periodicamente (via cron ou manual) e busca deals atualizados nos últimos 35 minutos
- **Cria leads novos** se o deal tem `person.email` e `person.name` e não existe na tabela (nem por `piperun_id` nem por `email`)
- **Atualiza leads existentes** se já existe por `piperun_id` ou `email`
- Logs recentes mostram: `Total deals: 300, updated: 30, created: 0` — ou seja, está atualizando mas não criando novos (provavelmente todos já existem)

### 2. Webhook (`smart-ops-piperun-webhook`)
- Recebe eventos em tempo real do PipeRun
- **Porém, NÃO cria leads novos** — apenas atualiza leads que já existem por `piperun_id`
- Se o deal não tem correspondência na tabela, retorna 404

---

### Limitação identificada

O **webhook não cria leads**. Se um deal novo é criado no PipeRun e o sync periódico ainda não rodou, esse lead fica "invisível" até a próxima execução do sync.

### Problema adicional: Bloqueio Cloudflare

Conforme documentado na memória do sistema, requisições do Supabase (AWS Frankfurt) para a API PipeRun sofrem bloqueio 403 pelo Cloudflare ("Maintenance"), tornando o sync via polling pouco confiável. O webhook reverso é o canal mais confiável, mas ele não cria leads novos.

---

### Recomendação

Se quiser garantir que **todo lead novo do PipeRun entre automaticamente**, o plano seria:

1. **Modificar o webhook** (`smart-ops-piperun-webhook`) para criar o lead na `lia_attendances` quando não encontrar por `piperun_id` (em vez de retornar 404)
2. Isso eliminaria a dependência do sync periódico para novos leads

Quer que eu implemente essa melhoria?

