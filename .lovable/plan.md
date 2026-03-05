

## Enriquecer leads com dados do PipeRun e proteger deals abertos no Funil de Vendas

### Problema

1. Quando um lead entra por qualquer fonte (formulario, e-commerce, campanha), o `lia-assign` busca a Pessoa no PipeRun mas **nao popula** os dados das oportunidades existentes (propostas, empresa, historico) na `lia_attendances`
2. O `lia-assign` **sempre sobrescreve** o vendedor (`proprietario_lead_crm`) e a etapa (`ultima_etapa_comercial`) com valores novos — mesmo quando o lead ja tem um deal ABERTO no Funil de Vendas com um vendedor ativo trabalhando

### Solucao

#### Mudanca 1: Proteger deals abertos no Funil de Vendas (linhas 959-978 e 984-1006)

No `lia-assign`, apos buscar os deals da pessoa (linha 940), se existir um deal aberto no Funil de Vendas (`vendaDeal`):
- **NAO alterar** `owner_id` no PipeRun (remover da payload do `updateExistingDeal`)
- **NAO alterar** `proprietario_lead_crm`, `funil_entrada_crm`, `ultima_etapa_comercial` na `lia_attendances`
- Apenas atualizar custom fields e adicionar nota no deal
- Preservar o vendedor existente do deal (`vendaDeal.owner_id`) como fonte da verdade

Logica:
```text
if (vendaDeal) {
  // Ler owner_id DO DEAL, nao sobrescrever
  const existingOwnerId = Number(vendaDeal.owner_id);
  const existingOwnerName = PIPERUN_USERS[existingOwnerId]?.name;
  
  // Atualizar custom fields SEM mudar owner
  updateExistingDeal(..., SEM owner_id)
  
  // Na lia_attendances, preservar proprietario/etapa do deal
  updateFields.proprietario_lead_crm = existingOwnerName;
  updateFields.funil_entrada_crm = PIPELINE_NAMES[vendaDeal.pipeline_id];
  updateFields.ultima_etapa_comercial = STAGE_TO_ETAPA[vendaDeal.stage_id];
  
  // Pular round robin inteiro
}
```

#### Mudanca 2: Enriquecer lia_attendances com dados completos do PipeRun

Apos buscar os deals da pessoa, iterar por TODOS os deals (abertos + ganhos) e popular:
- `piperun_pipeline_id`, `piperun_stage_id`, `piperun_status`, `piperun_owner_id`
- `piperun_created_at`, `piperun_closed_at`, `piperun_value_mrr`
- `valor_oportunidade`, `data_primeiro_contato` (do deal mais antigo)
- `status_oportunidade` (se algum deal ganho → "ganha")
- `proposals_data` via custom fields do deal
- Dados da empresa: `empresa_cnpj`, `empresa_razao_social`, `empresa_nome`, `empresa_segmento`

Usar a funcao `mapDealToAttendance` ja existente para extrair os campos do deal principal (o aberto em Vendas, ou o mais recente).

#### Mudanca 3: Buscar dados da empresa no PipeRun

Apos resolver `companyId`, fazer `GET /companies/{id}` para popular campos da empresa na `lia_attendances`:
- `empresa_cnpj`, `empresa_razao_social`, `empresa_nome`
- `empresa_segmento`, `empresa_website`, `empresa_ie`

Nova funcao `fetchCompanyData(apiToken, companyId)` no `lia-assign`.

### Arquivos a editar

| Arquivo | Mudanca |
|---|---|
| `supabase/functions/smart-ops-lia-assign/index.ts` | Proteger deal aberto em Vendas + enriquecer com dados de todos os deals + buscar empresa |
| `supabase/functions/smart-ops-ecommerce-webhook/index.ts` | Garantir que nao sobrescreve `lead_status`/`proprietario_lead_crm` se deal aberto em Vendas |

### Fluxo corrigido

```text
Lead entra (qualquer fonte)
  → ingest-lead: upsert na lia_attendances
  → lia-assign:
    → Busca Pessoa por email no PipeRun
    → Busca todos os deals da Pessoa
    → TEM deal aberto em Vendas?
      SIM → Preserva vendedor + etapa
           → Atualiza APENAS custom fields + nota
           → Popula lia_attendances com dados do deal
      NAO → Fluxo normal (round robin, criar deal, etc)
    → Busca empresa → popula campos empresa
    → Popula lia_attendances com dados de todos os deals
    → Dispara cognitive-analysis com dados completos
```

### Regra de ouro

> Se `pipeline_id === VENDAS && status === 0` (aberto): **NUNCA** alterar `owner_id` nem `stage_id` no PipeRun, e **NUNCA** sobrescrever `proprietario_lead_crm` nem `ultima_etapa_comercial` na base local.

