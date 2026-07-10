# Diagnóstico: leads dos forms não estão indo pra Vendas

## Não é quebra de formulário no frontend

Últimas 48h em `lia_attendances`:

| Origem | Leads criados | Com `piperun_id` | Rejeitados no ingest |
|---|---|---|---|
| Meta Lead Ads (12 leads distintos) | 12 | 12 ✅ | **2 leads (Zahn3D, César H.)** em loop |
| Forms internos (`# - FORMS - exocad…`) | 3 | 3 ✅ (18784/83896/83813) | 0 |
| Loja Integrada / orçamento | 3 | 3 ✅ | 0 |

**Forms do sistema não estão quebrando**. Nenhum rejeitado por identity, nenhum órfão.

## Dois problemas reais que os logs revelam

### Problema A — 2 leads Meta em loop de rejeição (1090 tentativas em 48h)

`system_health_logs.error_type = lead_rejected_missing_identity`:

| Nome enviado pela Meta | Email | Tentativas 24h |
|---|---|---|
| `𝙕𝙖𝙝𝙣3𝘿 𝘿𝙚𝙣𝙩𝙖𝙡 𝙇𝙖𝙗` | elisangelaruth@gmail.com | 257 |
| `𝘊𝘌𝘚𝘈𝘙 𝘏𝘌𝘕𝘙𝘐𝘘𝘜𝘌 𝘋𝘌𝘕𝘛𝘈𝘓 𝘈𝘙𝘛` | mara.milbraadt@gmail.com | 257 |

Nomes usam **Mathematical Alphanumeric Symbols** (U+1D400–U+1D7FF) — fonte decorativa que labs usam em perfis do Instagram. A regex `/[^A-Za-zÀ-ÿ]/g` em `_shared/lead-identity-guard.ts` L62 descarta esses glifos → `alpha.length < 2` → marca como fake → nunca entra no sistema. Meta reentrega a cada 5 min.

### Problema B — 6.515 rejeições `existing_lead_no_new_conversion_cdp_only` em 24h

Golden Rule Fail-Closed em `smart-ops-lia-assign` L2815 (correto por design) barra ação CRM em lead com vínculo quando o caller não confirma nova conversão. O caller (`smart-ops-ingest-lead` L1189) calcula `allowCommercialReactivation` como:

```ts
allowCommercialReactivation =
  !knownIds.has(dedupeId) &&
  !knownInHistory &&
  !priorConversion?.id;
```

Quando **qualquer um** desses três der positivo, o lead fica CDP-only. Meta reenvia o mesmo `leadgen_id` a cada 2 min → `knownIds.has(dedupeId)` acerta na 2ª entrega → 3.257 leads × ~2 hits/hora = os 6.515 registros. Isso é o comportamento correto para redelivery real, mas o **volume massivo** indica que a régua pode estar barrando também **submissões genuinamente novas** que caíram no mesmo caminho por causa do arquivamento agressivo de `previous_platform_lead_ids`.

## Correções

### 1. Aceitar Unicode estilizado no identity guard
`supabase/functions/_shared/lead-identity-guard.ts`:
- Adicionar `normalizeStyledLetters(s)` mapeando U+1D400–U+1D7FF para ASCII A–Z/a–z + `.normalize("NFKC")` (cobre também Enclosed Alphanumerics ⓐⒶ, fullwidth, etc.).
- Aplicar em `isFakeName` antes da checagem `alpha.length < 2`.
- Exportar `sanitizeDisplayName(s)` para uso no `smart-ops-ingest-lead` no ponto onde `nome` vai pro insert (~L1503 e ~L1167), de forma que o card salve `Zahn3D Dental Lab` legível em vez do glifo.

### 2. Reprocessar os 2 leads presos
Após deploy, invocar `smart-ops-ingest-lead` uma vez com o payload arquivado desses dois leadgen_ids (ou via `smart-ops-lia-assign force=true` se o CDP row já existir) para eles finalmente entrarem no Vendas 18784.

### 3. Diagnóstico da régua `allowCommercialReactivation` (leitura, sem edit ainda)
Adicionar um log em `smart-ops-ingest-lead` no branch existente (~L1189) que registra em `system_health_logs` com `error_type='reactivation_gate_evaluation'`:
- `dedupeId`, `known_via_previous_ids`, `known_in_history`, `prior_conversion_id`, `form_name`, `canonical_pipeline_id`.
Rodar 24h e re-analisar. Só ajustar a régua quando tivermos números concretos de quantos casos são "redelivery legítimo" vs. "novo form falso-positivo". **Não vou mexer na régua às cegas** — ela protege contra Deals duplicados (memory `golden-rule-deal-create-lock`, `vendas-pipeline-immutability`).

## Verificação pós-fix

- Logs `smart-ops-ingest-lead` param de emitir `identity incompleta: nome` para `elisangelaruth@gmail.com` e `mara.milbraadt@gmail.com`.
- Dois leads aparecem em `lia_attendances` com `piperun_id` preenchido, pipeline 18784, form `# - GlazeON- Smart Dent`.
- `system_health_logs.reactivation_gate_evaluation` (nova métrica) dá base pra decisão fase 2.

## O que NÃO muda nesta fase
- Golden Rule Fail-Closed continua ativo.
- Régua de `allowCommercialReactivation` intacta — apenas instrumentada.
- Forms do sistema, loja integrada, webhooks Meta: sem alteração.
- Nenhum arquivo do frontend tocado.
