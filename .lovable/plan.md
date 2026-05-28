## Objetivo
Corrigir o builder do briefing do vendedor (`supabase/functions/_shared/seller-summary.ts`) para que as seções 📋 Formulários, 💬 Dra. L.I.A., 📊 CRM (status do deal) e 🧠 Inteligência parem de aparecer vazias / com "aberto".

## Diagnóstico confirmado no banco
- `lead_form_submissions` existe mas tem **0 linhas**. `smartops_form_field_responses` tem 59 e `lead_id` referencia `lia_attendances.id` (100% bate). → Bug 1 confirmado.
- `agent_interactions.lead_id` referencia `public.leads` (não `lia_attendances`). O código atual já consulta `leads` por email — tecnicamente correto, mas `lia_attendances` já possui `total_messages` / `total_sessions` (29 leads com msgs) — fonte de verdade direta. → Bug 2 parcialmente real: usar os contadores do próprio `lia_attendances` e fazer fallback do `leads.id` via email só para puxar as últimas perguntas.
- `piperun_deals_history[*]` usa a chave **`status`** (valores `aberta` / `ganha` / `perdida`); `status_name` não existe. Linha 143 mostra sempre "aberto". → Bug 5 confirmado.
- `workflow_cell_mappings` tem 209 linhas (154 produtos) — não está vazia. Bug 4 não é estrutural; se diagnóstico vier vazio é por falha de matching (já tratado em outro fix). Sem ação aqui.
- Campos de inteligência (`confidence_score_analysis` etc.) só existem após `smart-ops-cognitive-analysis` rodar. Não vamos disparar a análise dentro do builder (seria custoso e fora de escopo do summary) — apenas garantir que a seção aparece quando preenchida (já é o caso). Bug 3 fica documentado como esperado; correção real é orquestrar a cognitive antes do briefing, que é trabalho de outra função (`lia-assign`). Sem ação no builder.

## Mudanças em `supabase/functions/_shared/seller-summary.ts`

### 1. Trocar fonte de formulários (Bug 1)
Substituir a 3ª promise do `Promise.all` (linhas 77-81):
```ts
supabase.from("smartops_form_field_responses")
  .select("field_name:field_id,field_label,value,created_at,form_id")
  .eq("lead_id", leadId)
  .order("created_at", { ascending: false })
  .limit(30)
```
Renderizar agrupando por `form_id` (com lookup paralelo em `smartops_forms(id, name)` para ter o nome do form) e listando `field_label: value` por grupo. Manter o bloco `highlightFormResponses` no topo como hoje. Remover a referência a `form_type` / `form_data` / `equipment_mentioned` / `product_mentioned`.

### 2. Interações Dra. L.I.A. (Bug 2)
- Usar `lead.total_sessions` / `lead.total_messages` (campos já presentes em `lia_attendances`) como números base — sem nova query.
- Para "últimas perguntas": manter a busca em `leads` por email → `agent_interactions.lead_id`, **mas** se não encontrar nada, fazer fallback consultando `agent_interactions` direto via `session_id` (telefone digits do lead). Limite 5, ordenado por `created_at desc`.
- Se ambos vierem vazios e `total_messages = 0`, ocultar a seção (em vez de mostrar "0 sessões / 0 mensagens").

### 3. Status correto dos deals históricos (Bug 5)
Na linha 143 trocar `d.status_name || "aberto"` por `d.status || "aberto"`. A contagem win/loss/open (linha 134) já lê `d.status` no fallback, mas vamos simplificar para `d.status` direto (o `status_name` nunca chega aí).

### 4. Limpeza
- Remover a 4ª promise (`lead_activity_log`) — o resultado `activityRes` nunca é consumido no arquivo. Reduz I/O.
- Remover `lead_form_submissions` da árvore de tipos `src/integrations/supabase/types.ts` **não** será mexido (auto-gerado).

## Fora de escopo
- Bug 3 (cognitive analysis on-demand): exige orquestração em `smart-ops-lia-assign` — pode virar tarefa separada.
- Bug 4 (workflow_cell_mappings): tabela já populada; problema de matching foi tratado em `intent-matching-no-cross-stage`.
- Frontend / UI: nenhuma alteração; só edge function.

## Validação
Rodar `smart-ops-preview-seller-note?email=danilohen@gmail.com` (lead IoConnect com agent_interactions) e `?email=contato@clinicaomi.com.br` e conferir que:
- 📋 Formulários lista os field_label/value de `smartops_form_field_responses`
- 💬 Dra. L.I.A. mostra `total_messages` correto e perguntas reais (para Danilo)
- 📊 CRM mostra "Ganha"/"Perdida"/"aberta" reais nos últimos deals
- Não aparece nada da tabela `lead_form_submissions`