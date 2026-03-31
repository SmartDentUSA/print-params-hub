
Você está certo: ainda há erros reais ativos; “implementação ok” só valia para o endpoint responder, não para o fluxo completo sem falhas.

**Diagnóstico confirmado**
1. **Meta Webhook**  
   - A função está online, mas há log recente: `Verification failed. Token mismatch`.
   - Resultado: o Meta não valida o webhook de forma consistente e os leads não entram (`lead_activity_log` de meta está zerado).

2. **OMIE (cron)**  
   - Jobs `omie-sync-morning` e `omie-sync-evening` estão ativos e “succeeded” no SQL.
   - Porém não há logs da função `omie-lead-enricher` e `omie_parcelas` está com **0 registros**.
   - Há indício de timeout de `net.http_post` no banco, então o cron “executa”, mas a chamada HTTP não conclui como esperado.

3. **PipeRun Sync**  
   - Logs atuais com muitos `duplicate key` em:
     - `lia_attendances_piperun_id_key`
     - `lia_attendances_email_ci_key`
   - Existe volume relevante de leads já mesclados (`merged_into`) ainda com `piperun_id`, o que gera colisão quando o canônico tenta assumir esse `piperun_id`.

---

**Plano de correção (implementação)**
1. **Blindar verificação do Meta webhook** (`supabase/functions/smart-ops-meta-lead-webhook/index.ts`)
   - Normalizar comparação do token (`trim`) e registrar diagnóstico seguro (sem vazar segredo).
   - Melhorar logs de GET/POST para separar claramente falha de token, payload inválido e erro Graph API.

2. **Corrigir merge com conflito de unicidade no PipeRun** (`supabase/functions/smart-ops-sync-piperun/index.ts`)
   - No caminho de conflito, liberar primeiro a chave única do lead que será marcado como `merged_into` (especialmente `piperun_id`) antes de gravar no canônico.
   - Melhorar fallback de resolução por email quando houver registros já mesclados.
   - Normalizar email de entrada para evitar colisões por formato (ex.: lista separada por vírgula).

3. **Limpeza de legado que alimenta conflito** (migration SQL)
   - Limpar `piperun_id/piperun_link` de registros já mesclados (`merged_into IS NOT NULL`) para remover colisão histórica.
   - Preservar rastreabilidade em auditoria (sem mexer em `lead_activity_log` schema).

4. **Estabilizar cron OMIE** (migration SQL + ajuste leve da função)
   - Recriar jobs OMIE com timeout HTTP adequado no `net.http_post`.
   - Separar execução agendada “rápida” do backfill completo (backfill pesado fica manual/on-demand).
   - Manter job de cobrança via `action=cobrancas` no horário operacional.

5. **Observabilidade mínima obrigatória**
   - Logs estruturados de início/fim com contadores e duração em Meta/OMIE/PipeRun.
   - Erros externos sempre com status + contexto resumido (sem PII sensível).

---

**Validação fim a fim (obrigatória)**
1. **Meta**: verificação GET + lead real no Lead Ads Testing Tool + confirmação no `lead_activity_log`.
2. **OMIE**: execução manual + logs presentes + `omie_parcelas` populando.
3. **PipeRun**: sync incremental sem novos `duplicate key` e atualização normal de leads.

---

**Detalhes técnicos**
- Arquivos alvo:
  - `supabase/functions/smart-ops-meta-lead-webhook/index.ts`
  - `supabase/functions/smart-ops-sync-piperun/index.ts`
  - `supabase/functions/omie-lead-enricher/index.ts`
  - `supabase/migrations/*` (limpeza de dados + reconfiguração de cron)
- Restrições respeitadas:
  - sem alterar `lead_activity_log` schema,
  - sem mudar RLS existente,
  - sem violar Golden Rule de owner/stage em pipeline de vendas aberto.
