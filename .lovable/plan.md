

## Diagnóstico Real: Webhook vs Sync — Gap de Mapeamento

Após análise detalhada do código, os campos que você listou como "faltantes" **já estão mapeados no webhook** (`smart-ops-piperun-webhook`). O problema real é diferente:

### O que está acontecendo

1. **Webhook** (`smart-ops-piperun-webhook`): Usa `extractIds()` — extrai **60+ campos** profundos (empresa_nome, empresa_cnpj, origem, person deep fields, etc.) ✅
2. **Sync periódico** (`smart-ops-sync-piperun`): Usa apenas `mapDealToAttendance()` do shared field map — extrai **~40 campos** mas **não extrai** empresa_nome, empresa_cnpj, pessoa_cargo, pessoa_linkedin, empresa_segmento, etc. ❌

### Resultado visível
- Leads que entraram via **webhook** → campos preenchidos (empresa, origem, etc.)
- Leads que entraram via **sync** (cron 20min ou full sync) → campos vazios para empresa, pessoa, origem detalhada

### Por que `piperun_title` e `piperun_stage_id` estão 30% null
O sync chama `mapDealToAttendance()` que **já mapeia** esses campos (linhas 460-453 do shared), mas o sync depois faz um "smart merge" que remove nulls — se o deal da API não traz `stage.name` (campo aninhado), o campo fica null.

### Campos que o PipeRun webhook NÃO envia (limitação da plataforma)
- `activities` — PipeRun **não inclui** activities no payload do webhook, só na API com `with[]=activities`  
- `forms` — Idem, só via API
- `fields` (custom fields da pessoa) — Parcial no webhook, completo via API

---

## Plano de Correção

### 1. Enriquecer `mapDealToAttendance()` no shared field map
Adicionar a mesma extração profunda de person/company que o webhook faz via `extractIds()`. Campos a adicionar:

**Person (12 campos):**
`pessoa_hash`, `pessoa_cpf`, `pessoa_cargo`, `pessoa_genero`, `pessoa_linkedin`, `pessoa_facebook`, `pessoa_observation`, `pessoa_website`, `pessoa_nascimento`, `pessoa_endereco`, `pessoa_rdstation`, `pessoa_manager`

**Company (18 campos):**
`empresa_nome`, `empresa_razao_social`, `empresa_cnpj`, `empresa_ie`, `empresa_cnae`, `empresa_website`, `empresa_segmento`, `empresa_situacao`, `empresa_facebook`, `empresa_linkedin`, `empresa_touch_model`, `empresa_porte`, `empresa_pais`, `empresa_cidade`, `empresa_uf`, `empresa_endereco`, `empresa_telefone`, `empresa_email`

**Cidade/UF do lead:**
`cidade` (from person.city.name), `uf` (from person state cascade)

### 2. Adicionar `with[]=activities` ao sync
O sync já pede `with[]=proposals,person,origin,stage` — adicionar `activities` e `tags` para capturar histórico de atividades e tags via API.

### 3. Aplicar campos no sync loop
O loop do sync (`smart-ops-sync-piperun`) aplica `mapDealToAttendance()` mas depois só faz smart merge. Garantir que os novos campos sejam incluídos.

### Arquivos editados
- `supabase/functions/_shared/piperun-field-map.ts` — expandir `mapDealToAttendance()`
- `supabase/functions/smart-ops-sync-piperun/index.ts` — adicionar `activities` e `tags` ao `with[]`

### Resultado esperado
- Sync periódico preencherá os mesmos 60+ campos que o webhook
- Leads existentes serão enriquecidos na próxima execução do sync
- Taxa de preenchimento subirá de 53% → ~85%+

