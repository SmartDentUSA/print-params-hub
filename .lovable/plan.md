## Diagnóstico — lead `estampasdorei@gmail.com` (Pedro Henrique)

### O que aconteceu
1. O lead **foi ingerido** em `lia_attendances` (id `2cc2f2f2…`) via `smart-ops-meta-lead-webhook` → `smart-ops-ingest-lead` → `smart-ops-lia-assign`.
2. O `smart-ops-lia-assign` foi disparado, fez round-robin (Patrica Silva), enviou WhatsApp, **mas a criação da Pessoa no Piperun falhou** — `system_health_logs` registra:
   - `function_name: smart-ops-lia-assign`
   - `error_type: crm_person_creation_failed`
   - `details.flow: error_no_person`
   - Como `personId` voltou `null`, **o deal nunca foi criado**, e por isso o lead ficou sem `piperun_id`, sem `pessoa_piperun_id`, sem `proprietario_lead_crm` persistido, sem `origem_campanha`, sem nenhum dado de deal.
3. Além disso, dados que o webhook enviou (`meta_form_id`, `meta_campaign_id`, `meta_campaign_name`, `meta_platform`, `meta_ad_id`, etc.) **não foram persistidos** nas colunas dedicadas (`platform`, `platform_form_id`, `platform_campaign_id`, `platform_ad_id`, `origem_campanha`) porque o `smart-ops-ingest-lead` **não mapeia chaves `meta_*` → colunas `platform_*`** e o auto-forward só copia chaves cujo nome bate exatamente com a coluna.
4. Equipamentos `equip_scanner` / `equip_impressora` ficaram vazios porque o formulário Meta enviou **`tem_scanner=não` / `tem_impressora=não`** (declaração de "ainda não tenho"), e `produto_interesse=RayShape Edge Mini` é interesse, não posse — portanto o campo correto a popular seria um indicador de **interesse**, não `equip_*`.

### Plano de correção (2 frentes)

#### Frente A — Backend: garantir que o lead complete o ciclo

A1. **Capturar e logar o erro real do Piperun em `createPerson`**
- Em `supabase/functions/smart-ops-lia-assign/index.ts` (`createPerson`), quando `createRes.success === false`, gravar em `system_health_logs` o `status` HTTP, o corpo de erro e o payload enviado. Hoje só faz `console.warn` e some.

A2. **Mapear chaves `meta_*` → colunas dedicadas no `smart-ops-ingest-lead`**
- Em `supabase/functions/smart-ops-ingest-lead/index.ts`, adicionar ao `incomingData`:
  - `platform` ← `payload.meta_platform`
  - `platform_lead_id` ← `payload.meta_leadgen_id`
  - `platform_form_id` ← `payload.meta_form_id`
  - `platform_campaign_id` ← `payload.meta_campaign_id`
  - `platform_ad_id` ← `payload.meta_ad_id`
  - `platform_adgroup_id` ← `payload.meta_adset_id`
  - `origem_campanha` ← já recebe `payload.origem_campanha`; o webhook já envia → conferir que o auto-forward não está caindo fora.
- Garantir `origem_primeiro_contato` = `meta_campaign_name` (campanha real) quando vindo de Meta, conforme memória `Person vs Deal Origin`.

A3. **Auto-retry de Piperun quando `error_no_person`**
- Criar uma função SQL/cron simples (ou job leve) que detecta leads com `merged_into IS NULL`, `email IS NOT NULL`, `piperun_id IS NULL` e `created_at > now() - interval '7 days'` e re-dispara `smart-ops-lia-assign` com `force=true`. Limitar a 1 retry por lead via flag em `raw_payload.piperun_retry_attempted_at`.

A4. **Backfill pontual deste lead**
- Após (A1) estar deployado, re-disparar `smart-ops-lia-assign` para `lead_id=2cc2f2f2-c1b7-4a1e-bda6-d28e1b7b2e2f` com `force=true` para identificar a causa raiz (provavelmente nome/duplicado/telefone). Se for telefone, normalizar; se for duplicado, recuperar `personId` existente.

#### Frente B — Frontend: card do lead exibir "última conversão"

B1. **Bloco "Última Conversão" no `KanbanLeadDetail` e `SmartOpsLeadsList`**
- Novo card/seção compacta com:
  - **Campanha**: `meta_campaign_name` (raw_payload) → fallback `utm_campaign` → fallback `origem_campanha`
  - **Conjunto/Anúncio**: `meta_adset_name` / `meta_ad_name` quando disponíveis
  - **Formulário**: `form_name`
  - **Produto de interesse**: `produto_interesse` / `produto_interesse_auto`
  - **Plataforma**: `platform` (Meta/Instagram/Facebook) com badge
  - **Data da última conversão**: maior `submitted_at` em `raw_payload.form_submissions`
  - **Status do deal Piperun**: badge verde se `piperun_id` existe, vermelho "Falha ao sincronizar — clicar para reprocessar" caso `system_health_logs` tenha `crm_person_creation_failed` para o `lead.email`.
- Botão **"Reprocessar Piperun"** → chama `smart-ops-lia-assign` com `force=true`.

B2. **Lista (`SmartOpsLeadsList`)**: nova coluna/etiqueta "Última conversão" mostrando a campanha + ícone de plataforma para rapidamente identificar a origem do toque mais recente sem abrir o card.

### Arquivos a tocar
- `supabase/functions/smart-ops-lia-assign/index.ts` (logging detalhado em `createPerson`)
- `supabase/functions/smart-ops-ingest-lead/index.ts` (mapeamento `meta_*` → `platform_*`)
- Migração: cron/edge function `smart-ops-piperun-retry-failed-leads` (opcional, se quisermos automação)
- `src/components/smartops/KanbanLeadDetail.tsx` (bloco Última Conversão + botão reprocessar)
- `src/components/SmartOpsLeadsList.tsx` (coluna/badge de última conversão)

### Fora de escopo
- Não vou tocar regra de `equip_*` neste plano — a fonte de verdade de equipamentos continua sendo Piperun `deal_items` (memória vigente). `tem_scanner=não` significa interesse, não posse.

Posso prosseguir com Frente A primeiro (descobrir a causa do erro Piperun e corrigir o mapeamento meta→platform), e depois Frente B (UI)?