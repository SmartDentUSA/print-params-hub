## Veredito

**Sim — os 52 formulários clonados entram na base de leads e disparam o mesmo fluxo do `# - Formulário IoConnect` / `# - Formulário exocad I.A.`**, com 2 pontos de atenção (não bloqueantes) listados ao final.

## O que foi verificado

### 1. Roteamento da submissão (frontend)
`src/pages/PublicFormPage.tsx` (rota `/f/:slug`) é o único runtime público. Para qualquer slug ele:
- Lê `smartops_forms` pelo `slug`
- Monta o payload com `form_name = f.name` e `source = "form"`
- Chama `supabase.functions.invoke("smart-ops-ingest-lead", ...)`
- Após receber `lead_id`, persiste respostas em `smartops_form_field_responses` e chama `smart-ops-deal-form-note` (nota PipeRun)

→ Não há código específico do `ioconnect`/`exocad`. O fluxo é genérico, dirigido pelo registro.

### 2. Paridade de schema dos 52 clones
Query confirmando paridade com o template `ioconnect` (17 campos, mesmas `db_column`):

```
keys_match=true → 55 forms (todos os clones + ioconnect + RayShape + Padrão)
keys_match=false → 1 form (# - Formulário exocad I.A., 12 campos — original mais enxuto, pré-existente)
```

- Todos os 52 clones têm os **mesmos 17 `db_column`** do template.
- `name` é **único** em toda a tabela (sem colisões → nomes válidos para resolver origem PipeRun).
- 50/56 com `product_catalog_id` (5 nulos são cursos/acessos, esperado).

### 3. Guarda de intenção comercial (PipeRun)
`supabase/functions/_shared/commercial-intent.ts` aceita o lead como Deal quando:
```
lead.form_name && String(lead.form_name).trim().length > 0
  → eligible = true (reason: "form_submission")
```
Como toda submissão de `/f/:slug` envia `form_name = f.name`, **todos os 52 clones passam o guard** sem depender de whitelist de `source`.

### 4. Resolução de origem no PipeRun
Per `piperun-deal-metadata-rules`: `resolveOriginId(form_name)` faz lookup por nome exato + **criação dinâmica** com cache. Como cada clone tem `name` único e ativo, o PipeRun criará automaticamente a Origem na primeira submissão (sem fallback genérico).

### 5. Persistência de respostas e histórico
`form_data` por `form_name` é mergeado (cap 20 snapshots) e `raw_payload.custom_fields_history` cresce em append (cap 50), conforme memória `form-data-merge-and-custom-fields-history`. Como o discriminador é `form_name` (único), **não há colisão de bucket entre clones**.

## Pontos de atenção (não bloqueantes)

**A. 5 formulários sem `product_catalog_id`** — `Curso-presencial`, `curso-presencial-imersao-3-dias-chairside`, `print-make-imersao-clinica`, `acess-grupo-smartdent`, `acesso-smart-dent-academy`. Eles ingerem normalmente; só não terão o enrichment `produto_interesse_auto` via catálogo. Isso é correto (cursos têm domínio próprio em `smartops_courses`), mas vale confirmar se você quer mantê-los assim.

**B. Origens PipeRun serão criadas on-demand** — A primeira submissão de cada clone cria uma nova Origem ativa no PipeRun (52 novas origens). Comportamento esperado, mas gera ruído inicial no relatório de Origens. Alternativa: pré-criar via script antes de divulgar os formulários.

## Recomendação de validação ao vivo (opcional, fase build)

Smoke-test em 1 clone qualquer (ex.: `/f/ios-medit-i900`) com e-mail real:
1. Verificar `lia_attendances` ← novo registro com `form_name` correto e `piperun_id` populado em segundos.
2. Conferir nota "Resumo do Lead" no Deal PipeRun (via `smart-ops-deal-form-note`).
3. Validar `raw_payload.custom_fields_history[0].form_name` = nome do clone.

Sem código a alterar para que o fluxo funcione — a infra é genérica e os 52 clones já satisfazem todos os contratos.
