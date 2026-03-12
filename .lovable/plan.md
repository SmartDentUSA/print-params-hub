

# Plano: Enriquecimento Completo do Webhook PipeRun

## Contexto

O webhook `smart-ops-piperun-webhook` já captura ~20 campos do payload PipeRun. Porém, o PipeRun envia **200+ campos** no webhook. A tabela `lia_attendances` já possui ~30 colunas `piperun_*`, `pessoa_*` e `empresa_*` que **existem no banco mas nunca são preenchidas pelo webhook**. Além disso, há campos novos do payload que não têm coluna correspondente.

## O que será feito

### 1. Migration: Novas colunas para dados ainda sem lugar

Colunas a adicionar em `lia_attendances`:

| Coluna | Tipo | Origem PipeRun |
|--------|------|----------------|
| `empresa_cidade` | text | company.city.name |
| `empresa_uf` | text | company.city.uf |
| `empresa_facebook` | text | company.facebook |
| `empresa_linkedin` | text | company.linkedin |
| `empresa_touch_model` | text | company.status_touch (1-5) |
| `piperun_tags_raw` | jsonb | tags array completo |
| `piperun_origin_sub_name` | text | origin.origin.name (sub-origem) |
| `piperun_involved_users` | jsonb | involved_users array |
| `pessoa_website` | text | person.website |
| `pessoa_endereco` | jsonb | person.address |
| `empresa_endereco` | jsonb | company.address |

### 2. Atualizar `extractIds()` no webhook

Extrair do payload os objetos novos: `company`, `origin.origin` (sub-origin), `involved_users`, `proposals`.

### 3. Enriquecer o bloco de `updateData` no webhook

Mapear todos os campos do payload para as colunas existentes e novas:

**Deal-level (já existem no DB, falta mapear):**
- `deal.hash` → `piperun_hash`
- `deal.description` → `piperun_description`
- `deal.observation` → `piperun_observation`
- `deal.deleted` → `piperun_deleted`
- `deal.freezed` → `piperun_frozen`
- `deal.frozen_at` → `piperun_frozen_at`
- `deal.probability` → `piperun_probability`
- `deal.lead_time` → `piperun_lead_time`
- `deal.value_mrr` → `piperun_value_mrr`
- `deal.last_contact` → `piperun_last_contact_at`
- `deal.stage_changed_at` → `piperun_stage_changed_at`
- `deal.probably_closed_at` → `piperun_probably_closed_at`
- `deal.fields` → `piperun_custom_fields` (jsonb)

**Person-level (já existem no DB):**
- `person.cpf` → `pessoa_cpf`
- `person.job_title` → `pessoa_cargo`
- `person.gender` → `pessoa_genero`
- `person.linkedin` → `pessoa_linkedin`
- `person.facebook` → `pessoa_facebook`
- `person.observation` → `pessoa_observation`
- `person.birth_day` → `pessoa_nascimento`
- `person.address` → `pessoa_endereco` (novo, jsonb)
- `person.website` → `pessoa_website` (novo)

**Company-level (já existem no DB):**
- `company.cnpj` → `empresa_cnpj`
- `company.company_name` → `empresa_razao_social`
- `company.name` → `empresa_nome`
- `company.ie` → `empresa_ie`
- `company.segment.name` → `empresa_segmento`
- `company.size` → `empresa_porte`
- `company.company_situation` → `empresa_situacao`
- `company.website` → `empresa_website`
- `company.cnae` → `empresa_cnae`
- `company.fields` → `empresa_custom_fields` (jsonb)
- `company.city.name` → `empresa_cidade` (novo)
- `company.city.uf` → `empresa_uf` (novo)
- `company.facebook` → `empresa_facebook` (novo)
- `company.linkedin` → `empresa_linkedin` (novo)
- `company.status_touch` → `empresa_touch_model` (novo)
- `company.address` → `empresa_endereco` (novo, jsonb)

**Proposals:**
- `proposals` → `proposals_data` (jsonb, já existe)
- Calcular `proposals_total_value` e `proposals_total_mrr` somando valores
- `proposals_last_status` do último proposal

**Outros:**
- `tags` → `piperun_tags_raw` (novo, jsonb)
- `origin.origin` → `piperun_origin_sub_name` (novo)
- `involved_users` → `piperun_involved_users` (novo, jsonb)

### 4. Validação de secret (aprovado anteriormente)

Adicionar checagem de `X-Webhook-Secret` header no início do handler.

## Arquivos modificados

| Arquivo | Mudança |
|---------|---------|
| Migration SQL | ~11 novas colunas em `lia_attendances` |
| `supabase/functions/smart-ops-piperun-webhook/index.ts` | Extração completa do payload (~80 linhas novas no bloco updateData) + validação de secret |
| `src/integrations/supabase/types.ts` | Auto-atualizado com novas colunas |

## Resultado

Após a implementação, **100% dos campos** do payload do webhook PipeRun serão capturados e persistidos no hub central `lia_attendances`, eliminando perda de dados e habilitando segmentação avançada por empresa, propostas e perfil da pessoa.

