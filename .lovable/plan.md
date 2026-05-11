## Diagnóstico confirmado

O problema atual tem duas causas independentes no fluxo `smart-ops-lia-assign`:

1. **Patrica Silva ainda está ativa como `role='vendedor'` no banco**
   - `team_members.piperun_owner_id = 47675`
   - `nome_completo = 'Patrica Silva'`
   - `role = 'vendedor'`
   - Resultado: o round-robin ainda sorteia Patricia/Patrica e cria Deal com `owner_id=47675`.

2. **O Deal foi criado com `person_id`, mas o update do CDP falhou depois**
   - Logs mostram:
     - `Creating person: Jonathan Vicente de melo`
     - `Creating company for person 46863216`
     - `Created new deal: 59698741`
     - depois falha no banco: `column "value" does not exist`.
   - Isso impede `lia_attendances` de salvar `piperun_id`, `pessoa_piperun_id`, `empresa_piperun_id`, funil e proprietário corretos.
   - Por isso o sistema fica parecendo que criou Deal “sem vincular pessoa”, e em retentativas pode criar ou apontar para outro Deal.

## Plano de correção

### 1. Corrigir o cadastro da Patricia/Patrica no banco
Atualizar o registro existente em `team_members`:

- `nome_completo`: `Patricia Gastaldi`
- `role`: `lia_comms`
- manter `ativo = true`
- manter `whatsapp_number = 5516981158403`
- manter `waleads_api_key`, pois o número será usado para LIA/Copilot, não para venda.

Efeito: ela sai imediatamente de qualquer seleção por `role='vendedor'`.

### 2. Blindar o código contra owner bloqueado, mesmo se o banco voltar errado
Em `supabase/functions/smart-ops-lia-assign/index.ts`:

- Adicionar lista fixa de bloqueio:
  - `owner_id 47675`
  - nomes normalizados contendo Patricia/Patrica Gastaldi/Silva.
- Antes de preservar proprietário atual ou aceitar round-robin, validar:
  - se `piperun_owner_id === 47675`, rotear para `FALLBACK_OWNER_ID`.
  - se `proprietario_lead_crm` bater com Patricia/Patrica, rotear para `FALLBACK_OWNER_ID`.
- Não sortear outro vendedor nesse caso.
- Como o código já transforma `FALLBACK_OWNER_ID` em `Distribuidor de Leads`, o lead cairá no funil correto.

### 3. Corrigir o bug do update pós-criação do Deal
O erro `column "value" does not exist` indica que algum valor não-primitivo ainda chega ao `.update(lia_attendances)`, provavelmente vindo de dados de empresa/deal do PipeRun.

Ajuste proposto:

- Fortalecer o sanitizador de `updateFields` para aceitar apenas:
  - string
  - number
  - boolean
  - null
- Converter campos textuais vindos do PipeRun com uma função segura:
  - se vier `{ value: '...' }`, usar somente `'...'`
  - se vier array/objeto sem valor escalar claro, descartar e registrar log.
- Aplicar essa normalização especialmente em:
  - `empresa_nome`
  - `empresa_razao_social`
  - campos enriquecidos via `mapDealToAttendance`
  - campos vindos de `companyData`.

Efeito: o Deal criado passa a ser salvo corretamente no CDP com `piperun_id`, `pessoa_piperun_id` e `empresa_piperun_id`.

### 4. Corrigir o lead Jonathan recém-impactado
Depois da correção de código:

- Rodar uma atualização de dados no lead `07abbbb7-d740-4812-b0c9-2c3e218bbb51` para refletir o que já foi criado no PipeRun:
  - `piperun_id = 59698741`
  - `pessoa_piperun_id = 46863216`
  - `empresa_piperun_id = 22833574`
  - `proprietario_lead_crm = Distribuidor de Leads` ou o nome do owner fallback definido no mapeamento
  - `funil_entrada_crm = Distribuidor de Leads`
  - `ultima_etapa_comercial = distribuidor_leads`
- Se necessário, acionar novamente `smart-ops-lia-assign` com `force=true` para mover/corrigir o Deal no PipeRun para o owner/funil correto.

### 5. Atualizar mapeamento e memória operacional
- Em `_shared/piperun-field-map.ts`, manter `47675` no mapa apenas para histórico, mas marcar como `lia_comms`/não-vendedora.
- Registrar regra operacional: Patricia Gastaldi/owner `47675` nunca é vendedora; leads associados a ela vão para Distribuidor.

## Validação

Após implementar:

- Confirmar no banco que Patricia não aparece mais como `role='vendedor'`.
- Confirmar nos logs que round-robin não seleciona `47675`.
- Confirmar que o lead Jonathan fica com os IDs salvos no CDP.
- Confirmar que novos leads com Patricia/Patrica caem em `Distribuidor de Leads`.
- Confirmar que não há novo erro `column "value" does not exist` no `smart-ops-lia-assign`.