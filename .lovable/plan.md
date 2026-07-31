# Timeline Unificada: mostrar as respostas dos formulários

## Diagnóstico (verificado agora)

Hoje a Timeline **não mostra o que o lead respondeu**. Verificado:

- Em `lead_activity_log`, os eventos `form_submission` gravam apenas um resumo fino: `email`, `telefone`, `form_name`, `source`, `area_atuacao`, `produto_interesse`, `piperun_link`, `dedupe_key`. Nada de scanner/impressora/especialidade/volume/campos livres.
- No card (`LeadDetailPanel.tsx`, `buildTimeline`), eventos não-ecommerce renderizam título = `event_type` cru ("form_submission"), descrição = `entity_name` e detalhe só com `Valor`/`Status`/`Fonte`. Ou seja, mesmo os campos já presentes no `event_data` são descartados na tela.
- `smart-ops-leads-api` não retorna `form_data` (snapshots por formulário, com `responses`/`raw_fields`) nem `smartops_form_field_responses` (93 linhas) — então o front nem tem acesso às respostas completas.

## O que fazer

1. **API do card (`smart-ops-leads-api`)**: incluir no payload do lead
   - `form_data` (snapshots por `form_name`, já acumulados na ingestão), e
   - as linhas de `smartops_form_field_responses` do lead (label do campo + valor), agrupadas por submissão.
2. **Timeline (`LeadDetailPanel.tsx`)**:
   - Título amigável para `form_submission`: `📝 Formulário — <form_name>`.
   - Bloco de detalhe com **todos** os campos respondidos: primeiro os pares de `smartops_form_field_responses`/`form_data.responses`+`raw_fields` daquela submissão; fallback para o que existe no `event_data` (área, especialidade, produto de interesse, scanner, impressora, cidade/UF etc.).
   - Filtrar ruído técnico (`dedupe_key`, `piperun_link`, chaves vazias/`[object Object]`) e humanizar rótulos (`area_atuacao` → "Área de atuação").
   - Criar evento de timeline para snapshots de `form_data` que não tenham `lead_activity_log` correspondente, deduplicando por `form_name + submitted_at`.
3. **Ingestão (opcional, recomendado)**: gravar em `event_data.responses` o snapshot completo do formulário no evento `form_submission`, para que futuras submissões já cheguem completas sem depender de junção no front.

## Notas técnicas

- Deduplicação atual da timeline usa `event_type|entity_id`; ao adicionar eventos de `form_data` a chave passa a ser `form_name|submitted_at` para não duplicar com `form_submission`.
- Nada de mudança em funis (Vendas/CS), deals, ou regra de origem — mudança é de leitura/apresentação, mais o enriquecimento do `event_data` na ingestão (item 3), se aprovado.
