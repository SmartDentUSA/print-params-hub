---
name: PipeRun Deal Title Uniqueness
description: PipeRun deduplica Deal por título — nomes de 1 token recebem sufixo; match de Person por nome exige 2+ tokens
type: constraint
---
# Título de Deal precisa ser único (PipeRun deduplica por título)

`POST /deals` no PipeRun **não cria** um Deal novo quando já existe Deal com o
MESMO título: devolve o Deal existente e **reatribui** `person_id`/`reference`
ao payload enviado. Efeitos reais (CIPRO, 18–21/09/2026):

- Leads que digitaram só o primeiro nome ("Rafael", "Marcio") recebiam o Deal de
  outro cliente homônimo → a guarda `piperun_id_conflict` abortava a gravação e
  o lead ficava **sem negócio**.
- O Deal do cliente original era sobrescrito com os dados do lead novo
  (custom fields, pessoa, reference) — corrupção silenciosa de CRM.
- Cada retentativa criava uma Pessoa nova no PipeRun (ex. 49838365, 49842754,
  49846823), poluindo a base.

## Guardas implantadas — não remover

1. `createNewDeal` (`smart-ops-lia-assign/index.ts`): título com menos de 2
   tokens recebe sufixo `(últimos 8 dígitos do telefone)`, ou localpart do
   e-mail / prefixo do lead_id como fallback.
2. `findPersonExpanded` (`_shared/piperun-person-resolver.ts`): match de Person
   **por nome** só é aceito quando o nome tem 2+ tokens. Nome único nunca
   identifica pessoa.
3. `pessoa_piperun_id` é persistido **imediatamente** após `createPerson`, antes
   de qualquer etapa que possa abortar — evita Pessoa duplicada por retentativa.

## Reparo de Deal sequestrado
Restaurar `person_id`, `reference` e dar título único ao Deal original
(`PUT /deals/{id}`), e só então reprocessar o lead novo com
`new_conversion_confirmed: true` para gerar um Deal próprio.
