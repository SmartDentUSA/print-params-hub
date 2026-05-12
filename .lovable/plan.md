## Problema real

O problema não é distribuição/owner. É regressão de dados no PipeRun: os Deals estão sendo criados, mas o vínculo Pessoa/Empresa aparece sem e-mail e telefone visíveis, mesmo o CDP (`lia_attendances`) e a nota do Deal contendo esses dados.

Pelo código atual, o `smart-ops-lia-assign` até tenta publicar `emails[]` e `phones[]` na Pessoa, mas não existe uma verificação forte pós-criação do Deal para garantir que o PipeRun aceitou e manteve esses campos no card de Pessoa/Empresa. Também faltam campos de Pessoa que você listou (`cpf`, `birth_date`, `gender`, `cellphone`, `linkedin`, `facebook`) e a cascata correta de `job_title`.

## O que será corrigido

### 1. Reenvio completo de Pessoa no PipeRun

No fluxo `smart-ops-lia-assign`, após resolver/criar a Pessoa e após criar/atualizar o Deal, reenviar a Pessoa com payload completo baseado no CDP:

```text
Person:
- name              <- nome
- emails[]          <- email
- phones[]          <- telefone_normalized ou telefone_raw
- job_title         <- especialidade -> area_atuacao -> pessoa_cargo
- cpf               <- pessoa_cpf
- birth_date        <- pessoa_nascimento
- gender            <- pessoa_genero
- cellphone         <- telefone_normalized ou telefone_raw
- linkedin          <- pessoa_linkedin
- facebook          <- pessoa_facebook
```

Regras:
- Nunca criar Pessoa sem e-mail ou telefone.
- Nunca sobrescrever `origin_id` da Pessoa.
- Não depender da nota do Deal; a nota continua existindo, mas o card Pessoa precisa receber os campos estruturados.
- Se o PipeRun rejeitar algum campo isolado, registrar log e continuar tentando os campos críticos `emails[]` e `phones[]`.

### 2. Reenvio completo de Empresa no PipeRun

Após garantir `empresa_piperun_id`, reenviar Empresa com:

```text
Company:
- name       <- empresa_nome -> empresa_razao_social -> nome
- cnpj       <- empresa_cnpj
- segment    <- empresa_segmento
- website    <- empresa_website
- emails[]   <- email
- phones[]   <- telefone_normalized ou telefone_raw
- city/state <- cidade / uf quando disponíveis
```

Regras:
- Empresa deve ter contato quando não houver contato corporativo separado: usar e-mail/telefone do lead como fallback.
- Não criar empresa vazia quando não houver identificador mínimo; mas se já existe vínculo, enriquecer com os dados disponíveis.

### 3. Verificação pós-Deal para impedir card sem vínculo útil

Adicionar uma etapa pós-Deal:

```text
create/update Deal
  -> PUT Person com e-mail/telefone/campos completos
  -> PUT Company com e-mail/telefone/campos completos
  -> GET Person e Company
  -> logar se ainda estiver sem emails[] ou phones[]
```

Logs em `system_health_logs`:
- `piperun_person_resync_ok`
- `piperun_person_resync_failed`
- `piperun_company_resync_ok`
- `piperun_company_resync_failed`
- `piperun_contact_still_missing_after_resync`

### 4. Backfill/recuperação dos Deals já afetados

Ajustar `smart-ops-piperun-retry-failed-leads` para também reprocessar leads que já têm `piperun_id` e `pessoa_piperun_id`, mas precisam re-publicar Pessoa/Empresa.

Critério:
```text
merged_into IS NULL
piperun_id IS NOT NULL
pessoa_piperun_id IS NOT NULL
email OR telefone presente
```

Permitir chamada manual por e-mail, por exemplo:
```json
{ "force": true, "emails": ["l.franca11@gmail.com"], "mode": "contact_resync" }
```

Isso permite recuperar Luis Marcondes França e todos os cards recentes sem criar Deal duplicado.

### 5. Expor IDs PipeRun no Smart Ops

No card Kanban (`KanbanLeadCard.tsx`), mostrar links clicáveis:

```text
PR#59724041 · Pessoa#46892007 · Empresa#22835895
```

- Deal: `https://app.pipe.run/#/deals/{piperun_id}`
- Pessoa: `https://app.pipe.run/#/persons/{pessoa_piperun_id}`
- Empresa: `https://app.pipe.run/#/companies/{empresa_piperun_id}`

No detalhe do lead (`KanbanLeadDetail.tsx`), transformar `pessoa_piperun_id` e `empresa_piperun_id` em links clicáveis também.

## Arquivos a alterar

- `supabase/functions/smart-ops-lia-assign/index.ts`
  - fortalecer `updatePersonFields`
  - fortalecer `findOrCreateCompany`
  - adicionar verificação/reenvio pós-Deal

- `supabase/functions/smart-ops-piperun-retry-failed-leads/index.ts`
  - adicionar modo `contact_resync` para recuperar Deals existentes sem recriar oportunidades

- `src/components/smartops/KanbanLeadCard.tsx`
  - exibir links para Deal/Pessoa/Empresa

- `src/components/smartops/KanbanLeadDetail.tsx`
  - IDs PipeRun clicáveis em Pessoa/Empresa

- `mem/integration/piperun-person-contact-enrichment.md`
  - atualizar regra para incluir reenvio completo de Pessoa/Empresa pós-Deal

## Validação

1. Rodar o re-sync manual para `l.franca11@gmail.com`.
2. Conferir logs `piperun_person_resync_ok` e `piperun_company_resync_ok`.
3. Confirmar no PipeRun que o card da Pessoa não fica mais com “E-mail não informado” e “Telefone não informado”.
4. Confirmar no Smart Ops que os IDs Deal/Pessoa/Empresa aparecem clicáveis no card.

## Fora de escopo

- Não mexer em round-robin.
- Não mexer em distribuição de leads.
- Não alterar integração nativa Meta -> PipeRun.
- Não recriar Deals existentes.