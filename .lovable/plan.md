## Auditoria 2 — 3 bugs críticos descobertos

A primeira rodada de correção ajudou (78 leads recuperados), mas a investigação mais a fundo revela **bugs ainda mais sérios** que estão CORROMPENDO identidades. É preciso parar o backfill e corrigir antes de continuar.

---

### Bug A — Contaminação cruzada de leads (CRÍTICO, perda de dados)

`piperun_id` tem `UNIQUE constraint`. Quando o `lia-assign` chama `findPersonByEmail` para o lead Andreia (`andreiaknip@gmail.com`), o PipeRun retorna a Person `46856754` — que NÃO é da Andreia, é do `dr.fredericorezende@hotmail.com` (que tem `nome="AMANDA MOURA"` no DB local). O `lia-assign` então:

1. Atribui à Andreia o deal `59694622` da pessoa errada.
2. Tenta `UPDATE lia_attendances SET piperun_id=59694622 WHERE id=andreia` → **falha silenciosa por unique violation** (Frederico já tem esse piperun_id).
3. Lead Andreia fica `succeeded_at=now` mas `piperun_id=NULL`.
4. O cron retry vê success e nunca mais tenta.
5. **Andreia permanece órfã**, o deal fica vinculado em outro lead.

Casos confirmados no DB neste momento (post-backfill): **Andreia Knipp**, **Daniele/clinicaabascal_laboratorio**, **AMANDA MOURA/dentistaamandamoura**. Todos com `succeeded_at` mas `piperun_id=NULL`.

Pior ainda: vários leads antigos têm o `nome` reescrito por sync reversa do PipeRun com nomes de OUTRAS pessoas:
- `condominiomyflower67@gmail.com` ingestou "Néliton Ribeiro" → `nome="llello Poeta"`.
- `dr.fredericorezende@hotmail.com` → `nome="AMANDA MOURA"`.
- `felipepimpo78@gmail.com` ingestou "Felipe Pipo" → `nome="Felipe Garcia do Amaral"`.

E os leads que aparecem no painel sem email ("Ana Paula Benedito", "Lucas", "fabio", "Flavio Gomes Lima", "Ruani Schuster", etc) são DEALS criados no PipeRun que estão amarrados a Persons sem email — provavelmente Persons criadas pelo `createPerson` quando o email já estava em outra Person diferente, ou sync reversa de deals antigos do PipeRun.

### Bug B — Notificação WhatsApp ao vendedor com origem errada

No caso Adelmo, a notificação mostra:

```
📋 Formulário: # - Impressoras - Smart Dent
Origem: # - Impressoras - Smart Dent
```

No DB:
- `form_name = "# - Impressoras - Smart Dent"` (correto — esse é o nome do formulário Meta)
- `origem_campanha = "# - Impressoras - Smart Dent"` (ERRADO — deveria ser `# Leads INO100 Plus`)
- `origem_primeiro_contato = "# - Impressoras - Smart Dent"` (ERRADO — deveria ser `meta_lead_ads` ou a campanha real)
- Os IDs reais do Meta estão no payload bruto: `c:120242917040680470 # Leads INO100 Plus` (campanha), `as:120242917040670470 # INO100Plus_com_notebook` (adset), `ag:120242917040660470 #INO100_Plus_Com_notebook` (ad).

O webhook Meta está usando `form_name` como fallback para `origem_campanha` e `origem_primeiro_contato` em vez de extrair os campos reais (`campaign_name`, `adset_name`, `ad_name`) do payload Meta.

### Bug C — `piperun-retry` mascara unique-violation como sucesso

O cron classifica como sucesso qualquer resposta com `piperun_id` na resposta JSON, sem verificar se aquele ID foi de fato gravado no lead correto. Resultado: 3 leads marcados como `succeeded_at` mas com `piperun_id=NULL` no DB.

---

## Plano de correção

### Parte A — Travar contaminação no `lia-assign`

Em `supabase/functions/smart-ops-lia-assign/index.ts`:

1. **Antes de aceitar uma Person retornada pelo PipeRun**, validar duas vezes:
   - O Person retornado deve ter pelo menos 1 email cujo lowercase BATA EXATAMENTE com o `lead.email` solicitado (sem fallback por telefone se o email do lead foi informado).
   - Se nenhum email bate, **descarta o match e força createPerson**.
2. **Antes de gravar `piperun_id` no lead**, fazer SELECT de pré-checagem: se `piperun_id` já está em uso por outro lead canônico, NÃO atualizar — gravar `system_health_logs` com `error_type='piperun_id_conflict'` e `details: { conflicting_lead_id }`. O cron retry não pode marcar success neste caso.
3. **Tratar erro de update silencioso**: capturar `error` do Supabase update e retornar 500 quando ele existir, com `system_health_logs` específico.
4. **Nunca sobrescrever `nome` local com nome do PipeRun** quando o nome local foi informado em formulário. Adicionar guarda: se `lead.nome` não está vazio E não veio do próprio PipeRun (`origem_primeiro_contato='piperun_webhook'`), preservar.

### Parte B — Fix da extração Meta (origem real)

Em `supabase/functions/smart-ops-meta-lead-webhook/index.ts` (ou onde o lead Meta é construído):

1. Extrair do payload: `campaign_name` → `origem_campanha`, `adset_name` → `origem_adset`, `ad_name` → `origem_ad`.
2. Setar `origem_primeiro_contato = "meta_lead_ads"` para leads novos vindos via Meta (não duplicar com `form_name`).
3. Setar `form_name` = nome do form Meta (atual já correto).
4. Na notificação WA (`lia-assign` linha 730 e 897), trocar `📋 Formulário: ${form_name}` para mostrar:
   ```
   📋 Canal: ${source} (Meta Lead Ads / WhatsApp / Site)
   📝 Formulário: ${form_name}
   🎯 Campanha: ${origem_campanha} > ${origem_adset || "—"}
   ```

### Parte C — `piperun-retry` valida que `piperun_id` foi de fato persistido

Em `supabase/functions/smart-ops-piperun-retry-failed-leads/index.ts`:

1. Após chamar `lia-assign` e receber `piperun_id`, fazer um SELECT extra: `SELECT piperun_id FROM lia_attendances WHERE id=$lead_id`. Só marcar `succeeded_at` se o ID gravado bate com o ID retornado.
2. Se `lia-assign` retornou `piperun_id` mas o DB não persistiu → tratar como `piperun_id_conflict`, gravar `system_health_logs` com severity error e NÃO incrementar attempts (a falha não é do lead, é do código).

### Parte D — Reparo retroativo mais cauteloso

1. **Reverter contaminações conhecidas**: para os 3 leads (Andreia, Daniele, Amanda) que ficaram `succeeded_at` mas sem `piperun_id`, limpar `succeeded_at` e zerar `attempts`. Após a Parte A estar deployada, deixar o cron reprocessar — agora vai criar Person nova em vez de pegar a errada.
2. **Detectar todos os leads com nome contaminado** (nome local diferente do nome ingerido no `raw_payload.latest_payload.nome`): mostrar lista para revisão manual antes de qualquer ação automática. Não é seguro reescrever em massa.
3. **Detectar deals "órfãos"** no painel local (lista que o usuário viu: "Ana Paula Benedito", "Lucas", "fabio" sem email): rodar query para identificar leads com `pessoa_piperun_id` mas sem `email` localmente, e cruzar com PipeRun para ver se a pessoa lá tem email.

### Parte E — Monitoramento

Adicionar no `system-watchdog-deepseek`:
- Alerta quando `system_health_logs` registrar `piperun_id_conflict` ou `crm_person_creation_failed` mais de 3x em 1h.
- Query semanal: leads canônicos com `nome` divergente de `raw_payload.latest_payload.nome` → relatório de auditoria.

---

### Arquivos a alterar
1. `supabase/functions/smart-ops-lia-assign/index.ts` — guarda strict-email + pré-checagem unique + erro de update + preservar nome local.
2. `supabase/functions/smart-ops-meta-lead-webhook/index.ts` — extrair campaign/adset/ad reais, separar `form_name` de `origem_campanha`.
3. `supabase/functions/smart-ops-piperun-retry-failed-leads/index.ts` — validação pós-update, novo error_type.
4. 1 migration: limpar `succeeded_at` dos 3 leads contaminados; opcional: backfill de `origem_campanha` para leads Meta recentes a partir do `raw_payload.latest_payload`.

### Validação
- Recriar lead `andreiaknip@gmail.com` via retry → deve criar Person nova com email correto, deal novo, piperun_id no lead correto.
- Conferir notificação WA do próximo lead Meta: deve mostrar Canal = "Meta Lead Ads", Formulário = nome real, Campanha = `# Leads INO100 Plus`.
- `system_health_logs` deve registrar 0 eventos de `piperun_id_conflict` após 24h.

### Perguntas
1. **Sobre a Parte A.4 (preservação de nome)**: posso sobrescrever o nome local APENAS quando o PipeRun retornar nome com `>= 2 tokens` E o nome local for `null/vazio/email`? Isso é o mais conservador — se quiser permitir reescrita também quando o local tem 1 token (ex.: "Tiago" → "Tiago Reis CRO SP 94604"), me diga.
2. **Sobre os deals órfãos no painel** ("Ana Paula Benedito", "Lucas", "fabio" sem email): essas são pessoas/deals reais no PipeRun que vieram via outra fonte (manual? CSV antigo?), ou são contaminações? Quer que eu liste todos os 100+ deals afetados para você decidir caso a caso, ou prefere que eu deixe como está e foque só nos novos leads do Meta?
3. **Sobre o backfill remanescente** (3 leads ainda stuck): paro tudo até deployar a Parte A, ou quer que eu faça o reparo limpo só desses 3 manualmente agora?