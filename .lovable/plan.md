## Diagnóstico

**Lead em questão:** Dr. Otávio de Orlandis Carvalho — `otavio.orlandis1@gmail.com`
- Criado às 14:22 UTC via Meta Ads (formulário Impressoras / campanha "07_05_2026 RayShape+Cure").
- `piperun_id = null`, `pessoa_piperun_id = null`, sem deal, sem nota de vendedor.
- `system_health_logs` registrou `crm_person_creation_failed` com `flow=error_no_person`, mas **não há o log detalhado** `piperun_create_person_api_error` que deveria conter a resposta da API. Indica que `createPerson` retornou `null` sem completar o bloco de log detalhado (provável exceção silenciosa entre chamadas, ou retorno antecipado).

**Escala do problema:** 59 leads dos últimos 14 dias com `source` em (meta_lead_ads, form, sdr_captacao) estão sem `piperun_id` — todos deveriam estar no Piperun.

**Causas prováveis no `createPerson`:**
1. Nome `"Dr. Otávio de Orlandis Carvalho | Dentista em Divinópolis-MG"` é enviado bruto (sem `cleanPersonName`). Piperun pode rejeitar nomes com pipe `|` ou comprimento excessivo.
2. `cleanPersonName` atual não remove sufixos descritivos do tipo ` | <descrição SEO>`, ` - <cidade>`, `(...)`.
3. O detailed-log dentro de `createPerson` depende de uma segunda chamada Supabase com `service_role_key` — se algo falha silenciosamente, perdemos o motivo real do 4xx/5xx do Piperun.

## Mudanças propostas

### 1. `_shared/piperun-field-map.ts` — endurecer `cleanPersonName`
Adicionar regras determinísticas para gerar um nome aceito pelo Piperun:
- Truncar no primeiro de `|`, ` — `, ` - ` quando seguido de descritor (cidade, profissão, palavras como "Dentista", "Clínica", "Dr.", etc. devem ser preservadas se for prefixo).
- Remover parênteses e seu conteúdo.
- Limitar a ~80 caracteres.
- Manter rejeição de Zapier/Plug & Play/datas.
- Exportar nova função `sanitizePersonNameForPiperun(name)` reutilizando regras + retorno garantido (fallback para "Lead <primeiroNome>" ou para o e-mail).

### 2. `smart-ops-lia-assign/index.ts` — `createPerson` robusto
- Trocar `lead.nome` cru por `sanitizePersonNameForPiperun(lead.nome)` antes de montar `personPayload`.
- Em qualquer 4xx do Piperun ao criar Pessoa, fazer **retry automático** com nome reduzido a `firstName + lastName` derivado de `lead.nome` ou do e-mail; persistir no payload o nome usado.
- Garantir que o log `piperun_create_person_api_error` seja gravado **antes** de qualquer outra chamada que possa lançar (envolvê-lo em bloco próprio com `await` direto, sem depender do `createClient` interno que já existe lá; passar a instância `supabase` por parâmetro).
- Quando `createPerson` retornar `null`, gravar também `raw_payload.piperun_last_error = { status, body, name_used, attempt }` no `lia_attendances` para auditoria por lead.

### 3. `smart-ops-piperun-retry-failed-leads` — agendar via cron
- Adicionar entrada no `supabase/config.toml` para rodar a função a cada 15 min com `limit=25`, `lookback_days=7`, `force=false`.
- Garantir que ao retentar com sucesso, o fluxo dispare **`smart-ops-deal-form-note`** (que já usa `buildSellerDealSummaryHTML`) para postar a nota de vendedor no novo deal.
- Após sucesso, marcar `raw_payload.piperun_retry_attempted_at` (já existe) e `raw_payload.piperun_retry_succeeded_at` (novo) para visibilidade.

### 4. Backfill imediato dos 59 leads pendentes
- Após o deploy, chamar manualmente `smart-ops-piperun-retry-failed-leads` com `lookback_days=14` e `limit=100` para drenar a fila.
- Listar resultados (sucesso/erro) para o usuário aprovar.

### 5. Painel de visibilidade (opcional, sob aprovação)
- Adicionar um pequeno card em `SmartOpsSystemHealth.tsx` mostrando "Leads pendentes de Piperun" (count) e botão "Drenar agora" que chama a função de retry. Sem mexer em outras seções.

## Validação

1. Reenviar o lead `otavio.orlandis1@gmail.com` pela função de retry → deve criar Pessoa+Deal no Piperun, popular `piperun_id` e disparar nota de vendedor.
2. Conferir `system_health_logs`: novo registro `piperun_create_person_api_error` deve conter `payload_sent.name` sanitizado quando aplicável.
3. Rodar query: `SELECT count(*) FROM lia_attendances WHERE merged_into IS NULL AND piperun_id IS NULL AND source IN ('meta_lead_ads','form','sdr_captacao') AND created_at >= now() - interval '14 days'` — deve cair de 59 para próximo de 0.
4. Forçar caso sintético com nome contendo ` | descrição` para confirmar que o sanitizador entrega nome válido em primeira tentativa.

## Arquivos a alterar
- `supabase/functions/_shared/piperun-field-map.ts` (endurecer cleanPersonName + nova `sanitizePersonNameForPiperun`).
- `supabase/functions/smart-ops-lia-assign/index.ts` (`createPerson` robusto, retry, logging garantido, gravação de `piperun_last_error`).
- `supabase/functions/smart-ops-piperun-retry-failed-leads/index.ts` (acionar deal-form-note pós-sucesso, marcar `piperun_retry_succeeded_at`).
- `supabase/config.toml` (cron 15min).
- (opcional) `src/components/SmartOpsSystemHealth.tsx` (card + botão drenar).

## Fora de escopo
- Não alterar a lógica existente do `seller-summary` nem do `piperun-webhook`.
- Não tocar em integrações de e-commerce/Astron/Sellflux.
