
# Plano de ação — corrigir leads placeholder e duplicatas na importação

## Escopo confirmado

**19 leads** têm `email ILIKE 'deal-%@import.placeholder'` (mascarados como NULL pelo RPC — por isso aparecem "sem e-mail" no card). São todos leads criados por um importador de Deals que não encontrou o Person real do PipeRun no momento da importação.

**1 duplicata confirmada**: `MILLIAN ONDONTOLOGIA HUMANIZADA`
- `20ca6a5e-...` — piperun_id `53990777`, email placeholder (Deal importado)
- `edfebe45-...` — sem piperun_id, email real `femillian@gmail.com` (lead orgânico)
- Ambos apontam para a mesma clínica → precisam ser mesclados

Não há telefone em nenhum → dedupe por telefone não funcionou. Único sinal disponível: **nome normalizado** + **piperun_id** + **email real quando o Person do PipeRun for consultado**.

---

## Passo 1 — Enriquecer os 19 leads com dados reais do PipeRun Person

Edge function nova: `rayshape-fix-placeholder-leads`

Para cada lead com email placeholder:
1. Buscar o `Deal` no PipeRun (`GET /deals/{piperun_deal_id}` usando `piperun_id` do lead)
2. Extrair `person_id` do Deal
3. `GET /persons/{person_id}` → obter `email`, `phone`, `name` reais
4. Regravar em `lia_attendances`:
   - `email` = email real do Person (ou NULL se não houver)
   - `telefone_normalized` = phone normalizado (usa util `normalizeBrazilianPhone` do repo)
   - `nome` = mantém o atual **apenas se** o do Person for genérico; senão adota o do Person
   - **Nunca sobrescrever** `piperun_id` já existente (regra Smart Merge)

Fail-safe: se o Deal não tiver Person no PipeRun, apenas trocar `email` de `deal-*@import.placeholder` por `NULL`.

**Output esperado:** 19 leads com email/phone reais quando disponíveis; log de auditoria em `lead_enrichment_audit`.

## Passo 2 — Rodar merge automático usando os novos identificadores

Depois do Passo 1, alguns dos 19 leads passam a ter `email`/`telefone_normalized` que já existem em outro lead (o "orgânico"). Aí sim o merge por telefone/email funciona:

Chamar a função existente `fn_merge_leads_by_identity` (ou o job `lead-merge-system` — a memória `smart-ops/lead-merge-system-v2` documenta) para cada um dos 19 leads.

Para o caso já confirmado do **MILLIAN**, executar o merge manualmente na mesma passada:
- `merged_into` do `20ca6a5e-...` (placeholder) ← aponta para `edfebe45-...` (femillian)
- Copiar `piperun_id=53990777` do placeholder para o lead canônico (femillian está sem)
- Copiar `printer_deal_id` (via `deals.lead_id`) — na verdade só reatribuir `deals.lead_id` do placeholder para o canônico

## Passo 3 — Corrigir o importador para não gerar mais placeholders

Encontrar a edge function que cria esses leads com `email = 'deal-{id}@import.placeholder'` (provavelmente `piperun-backfill-deals` ou `import-piperun-deals`). Alterar o fluxo:

1. **Antes de criar** o lead placeholder, tentar buscar o Person do Deal no PipeRun.
2. Se encontrar Person com email/phone → criar lead com esses dados (evita placeholder).
3. Se Person existir mas sem email/phone → criar lead com `email = NULL` (não mais placeholder).
4. Se Deal não tem Person → manter o placeholder mas registrar em `lead_enrichment_audit` como `pending_person_link`.

Sem esse fix, novos Deals importados voltam a criar o mesmo problema.

## Passo 4 — Validação

Após Passos 1–3 rodarem:

```sql
-- 1. Nenhum placeholder novo deve existir
SELECT count(*) FROM lia_attendances
WHERE email ILIKE 'deal-%@import.placeholder' AND merged_into IS NULL;
-- Esperado: 0 (ou só os sem Person no PipeRun)

-- 2. MILLIAN unificado
SELECT id, nome, email, piperun_id, merged_into
FROM lia_attendances WHERE nome ILIKE 'MILLIAN%';
-- Esperado: 1 canônico com piperun_id=53990777, o outro com merged_into preenchido

-- 3. fn_rayshape_owners não muda de tamanho
SELECT jsonb_array_length(fn_rayshape_owners());
-- Esperado: 120 (contagem estável — merges só substituem, não removem donos)
```

E abrir o card `SmartOpsRayshape` no `/admin` para conferir que as 4 linhas antes vazias (M Veraldi, REJANE, Fabiano Rocha, MILLIAN placeholder) agora exibem e-mail real ou desaparecem por merge.

---

## Ordem de execução e ferramentas

| # | Ação | Ferramenta |
|---|---|---|
| 1 | Criar edge function `rayshape-fix-placeholder-leads` | code--apply_patch (build mode) |
| 2 | Rodar a function 1× para os 19 leads | curl_edge_functions após deploy |
| 3 | UPDATE de merge para o MILLIAN | supabase--insert |
| 4 | Alterar importador para não gerar placeholders | code--apply_patch |
| 5 | Validar via queries acima | supabase--read_query |

**Sem migração de schema** — nenhuma coluna nova é necessária. Tudo é UPDATE em `lia_attendances` + código em edge functions.

## Riscos e mitigações

- **PipeRun rate limit** durante enriquecimento: processar 19 leads em série com `await sleep(300ms)` — trivial.
- **Person do PipeRun com dados diferentes do nome atual do lead** (ex.: nome do Person é o sócio, nome do lead é razão social): manter o nome atual, só enriquecer email/phone. Evita destruir informação já correta.
- **Merge automático mesclar dois leads legítimos que só compartilham email genérico** (`contato@...`): aplicar `fn_merge_leads_by_identity` só quando **piperun_id ou telefone** também bater; email sozinho não basta se for genérico corporativo.
- **KPIs do card mudam de valor após merge**: possível reduzir 1–2 donos se o merge trouxer um lead que já era outro dono. Documentar delta na validação.

## O que NÃO farei sem sua aprovação

- Não vou alterar `fn_rayshape_owners` neste plano (é dado, não RPC).
- Não vou apagar leads placeholder — só ajustar `email`, `nome`, `phone`, `merged_into`.
- Não vou tocar em `deals` além de reatribuir `lead_id` no caso MILLIAN.

## Decisões que preciso de você

1. **Nome do lead**: quando o Person do PipeRun tiver nome diferente, mantenho o atual ou adoto o do Person? (Padrão sugerido: manter o atual.)
2. **Leads placeholder sem Person no PipeRun**: viro `email=NULL` ou deixo como está e só sinalizo em auditoria? (Padrão sugerido: virar NULL.)
3. Rodo o Passo 1 (enriquecimento) apenas para os 19 alvos ou expando para **todos** os leads com `email ILIKE 'deal-%@import.placeholder'` no banco (talvez tenha mais fora dos donos Rayshape)?
