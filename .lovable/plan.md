

# Exibir person_id/company_id e corrigir deal #56186037

## Diagnóstico

### Deal #56186037 (RayShape Edge Mini, R$26k)
Este deal foi sincronizado em 17/03 com o builder antigo. O snapshot armazenado tem:
- `proposals: []` (vazio)
- `product: "Allan Leonardo Rezende Coelho"` (errado — pegou o titulo do deal em vez do produto)
- Sem `person_id`, sem `company_id`, sem `deal_title`, sem `origem`

O chunked sync que implementamos ainda não re-processou este deal específico no pipeline 83896 (CS Onboarding). Precisamos forçar um re-sync deste pipeline.

### person_id / company_id no frontend
Somente o deal mais recente (#57961522) tem `person_id: 44194603`. Os 4 deals anteriores não têm porque foram sincronizados antes da adição desses campos. O frontend não exibe esses campos em nenhum lugar.

## Plano

### 1. Frontend: Adicionar person_id e company_id na tabela de Deals
**Arquivo**: `src/components/smartops/LeadDetailPanel.tsx`

Na tabela "Deals PipeRun" (linha 982), adicionar uma sub-linha discreta abaixo de cada deal row mostrando os IDs quando disponíveis:

```
👤 Pessoa: #44194603 · 🏢 Org: #12345
```

Formato: abaixo do deal row, mesma coluna do `deal_id`, em fonte mono pequena (9px), cor muted. Só aparece se pelo menos um dos IDs existir.

### 2. Backend: Forçar re-sync do pipeline 83896 com o novo builder
Chamar o edge function `smart-ops-sync-piperun` com `pipeline_id=83896&full=true` em chunks para que o deal #56186037 seja re-processado com o `buildRichDealSnapshot` atual, capturando:
- `proposals[]` com itens reais (RayShape Edge Mini)
- `person_id` e `company_id`
- `deal_title` e `origem` corretos

### Resultado esperado
- Todos os deals mostram `person_id` e `company_id` quando disponíveis
- Deal #56186037 passa a exibir "RayShape - Edge Mini" nos itens de proposta
- Deals mais antigos recebem os campos novos no próximo sync

