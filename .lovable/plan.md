# Fix: campaigns_status_check ao criar campanha SMS

## Causa raiz
`ensureSmsCampaign` em `src/components/SmartOpsCampaigns.tsx` (linha 1004) faz insert com `status: "draft"`, mas o CHECK constraint da tabela `campaigns` aceita apenas: `rascunho`, `agendada`, `em_execucao`, `concluida`, `cancelada`, `erro`.

## Mudança
- `src/components/SmartOpsCampaigns.tsx` linha 1004: trocar `status: "draft"` por `status: "rascunho"`.

Verificar se existem outras ocorrências de `status: "draft"`/`"sending"`/`"completed"`/`"failed"` etc. em inserts/updates contra `campaigns` no mesmo arquivo e mapear para a enumeração válida (`em_execucao`, `concluida`, `erro`) quando aplicável. Não alterar `campaign_sessions` (tabela diferente).

## Fora de escopo
- Schema do banco (constraint correto, código que deve se adequar).
- Lógica de SMS / edge functions.
