## Objetivo

Garantir que leads vindos de **Meta Lead Ads / Astron / outros canais** sigam **exatamente** o mesmo fluxo Pessoa → Organização → Deal já consolidado para o **Formulário exocad I.A.** (sistema-form), incluindo PESQUISAR, REATIVAR (Estagnados → Vendas) e CRIAR deals com custom fields populados.

## Fluxo de referência (exocad I.A.) — como funciona hoje

O sistema-form aciona `smart-ops-ingest-lead` → grava `lia_attendances` (com colunas top-level: nome, email, telefone, area_atuacao, especialidade, produto_interesse, tem_scanner, tem_impressora, etc.) + `form_responses` + `lead_form_submissions` → invoca `smart-ops-lia-assign`, que executa:

```text
1. findPersonByEmail  (estrito, sem fallback de telefone)
   ├── existe  → reutiliza, updatePersonFields
   └── não    → createPerson  (origin_id = form_name/origem_primeiro_contato)
2. findOrCreateCompany  (anexa Organização à Person)
3. findPersonDeals
   ├── Won deal           → NUNCA TOCA (preserva CS/Suporte)
   ├── Open em Vendas    → GOLDEN RULE: preserva owner/stage, só atualiza
   │                        customFields via PUT + adiciona nota
   ├── Open em Estagnados → moveDealToVendas (REATIVA + nota de reativação)
   └── nenhum            → createNewDeal (POST + PUT customFields + nota)
```

A população de custom fields no PipeRun depende de o `lia_attendances` ter os campos top-level corretos. O `mapAttendanceToDealCustomFields` faz fallback no `form_data`, mas o fluxo exocad funciona porque `smart-ops-ingest-lead` promove os campos para top-level antes do lia-assign rodar.

## Diagnóstico do problema atual

**Meta Lead Ads** já invoca o mesmo `smart-ops-ingest-lead` → `smart-ops-lia-assign`, mas o **payload normalizado** em `smart-ops-meta-lead-webhook` não cobre os mesmos campos top-level que o sistema-form. Resultado: deals são criados, mas os custom fields (WhatsApp, Aston, área, produto, scanner, impressora) ficam vazios — exatamente o caso do Deal #59699720 (Flávio).

Origem da divergência:
- Meta envia `phone_number`, `full_name`, etc. — `ingest-lead` mapeia esses para `telefone_raw`/`nome`, mas **não promove** `tem_impressora`, `tem_scanner`, `area_atuacao`, `especialidade` quando vêm em chaves não-canônicas do form Meta.
- `produto_interesse` é inferido por keywords no webhook, mas **não é normalizado** quando o usuário escreve "Elegoo", "Anycubic" etc. nas respostas.
- `form_data` recebe o payload bruto (catch-all), mas as colunas top-level ficam NULL → `mapAttendanceToDealCustomFields` tem que cair no fallback de sinônimos, que muitas vezes não bate.

## Mudanças propostas

### 1. `smart-ops-meta-lead-webhook/index.ts`
Espelhar a normalização do sistema-form: além de `email/full_name/phone_number`, **mapear explicitamente** todos os campos relevantes para as colunas canônicas que o lia-assign espera:
- `area_atuacao` ← `fields.area_de_atuacao | area_atuacao | area | atuacao`
- `especialidade` ← `fields.especialidade | specialty | especialidade_odontologica`
- `tem_scanner` ← `fields.tem_scanner | possui_scanner | scanner` (normalizado: sim/não/marca)
- `tem_impressora` ← `fields.tem_impressora | possui_impressora | impressora | impressoes_3d`
- `impressora_modelo` ← `fields.modelo_impressora | impressora_modelo | printer_model`
- `produto_interesse` ← cascata atual + também gravar `produto_interesse_auto` quando inferido por keyword
- `empresa_nome`, `empresa_razao_social`, `cidade`, `uf` quando presentes
- Garantir `telefone_raw` no payload mesmo quando `phone_number` vier formatado.

### 2. `smart-ops-ingest-lead/index.ts`
- Promover automaticamente para top-level **todos** os sinônimos conhecidos (`SYNONYMS` do `piperun-field-map.ts`) antes do INSERT/UPDATE em `lia_attendances`, não só os explícitos. Hoje já existe parte disso — completar para `tem_scanner`, `tem_impressora`, `impressora_modelo`, `area_atuacao`, `especialidade`.
- Garantir que quando `produto_interesse` vier como inferência (keyword), também grave em `produto_interesse_auto` (regra Behavioral Ingestion).

### 3. `smart-ops-lia-assign/index.ts` — sem mudanças no fluxo
O fluxo Pessoa→Empresa→Deal e a árvore de decisão (Won/Vendas/Estagnados/novo) **já está correta** — não tocar. Só validar que o `PUT /deals/{id}` com `customFieldsToHashMap(customFields)` (já adicionado em mudança anterior) está sendo chamado para todos os caminhos: criar novo, reativar de Estagnados, e GOLDEN RULE em Vendas.

### 4. Reprocessamento do Deal #59699720 (Flávio)
Após deploy, executar `smart-ops-lia-assign?force=true` para o lead `flaviobraga81@hotmail.com` para que o PUT preencha WhatsApp, área, produto, scanner, impressora.

### 5. Documentação
Atualizar `mem/integration/piperun-customfields-resilience.md` registrando que **Meta/Astron seguem o mesmo contrato top-level que sistema-form** — qualquer canal novo deve normalizar campos para colunas canônicas em `lia_attendances` antes de invocar lia-assign.

## Arquivos a alterar
- `supabase/functions/smart-ops-meta-lead-webhook/index.ts` (normalização ampliada)
- `supabase/functions/smart-ops-ingest-lead/index.ts` (promoção automática de sinônimos)
- `mem/integration/piperun-customfields-resilience.md` (regra de contrato)

## Não alterar
- A árvore de decisão de `smart-ops-lia-assign` (Won/Vendas/Estagnados/novo).
- `_shared/piperun-field-map.ts` (mapeamento PipeRun já correto após patch anterior).
- Fluxo Astron `astron_course_progress` (sem criação de Deal comercial — regra já vigente).
