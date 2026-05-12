## Resgate de leads `empty_person_unresolvable`

Hoje o sweeper marca como `unresolvable` quando `findPersonExpanded` não acha um Person "dono" dos contatos. Mas em casos como Vilmar (Person 46912647 já cacheado, vazio), nunca tentamos:
- reabrir o Person cacheado via `GET /persons/{id}` para confirmar se segue vazio,
- forçar um PUT atômico de `emails`+`phones` e validar via novo GET,
- ou, em último caso, abandonar o Person vazio e criar um novo limpo.

### Mudanças

**1. `_shared/piperun-person-resolver.ts`**
- Adicionar `forcePopulateCachedPerson(apiToken, personId, { email, phone, name })`:
  1. `GET /persons/{id}` → se já tem email OU phone, retorna `{ ok: true, alreadyHasContact: true }`.
  2. PUT atômico com `emails:[{email,type:'work'}]` + `phones:[{number, type:'work'}]` em payload mínimo (sem `name`/`custom_fields`).
  3. `GET /persons/{id}` de novo → se persistiu, `{ ok: true, populated: true }`. Se não, `{ ok: false, reason: 'piperun_silent_reject' }`.

**2. `piperun-person-empty-sweeper/index.ts`**
- Antes de `findPersonExpanded`, ler `lead.pessoa_piperun_id`. Se existir:
  - Tentar `forcePopulateCachedPerson`. Se popular → limpar `crm_creation_blocked` + reenfileirar `lia-assign` e logar `piperun_person_force_populated`.
- Se ainda falhar e o email tiver TLD inválido (`.TYPO`, regex de TLD válido), pular sem marcar `unresolvable` e logar `piperun_person_invalid_email_tld` (lead precisa correção humana — typo no formulário).
- Se email/telefone forem válidos mas PipeRun rejeitar silenciosamente, criar **novo Person** (`createPerson` com payload limpo), validar contato no novo ID, e atualizar `pessoa_piperun_id` para o novo + abandonar o antigo (log `piperun_person_replaced_silent_reject` com `old_id`/`new_id`).
- Só marca `unresolvable` quando: nem o force-populate, nem a busca expandida, nem o create-new conseguiram um Person com contato.

**3. `smart-ops-lia-assign/index.ts`**
- Quando `validateCachedPerson` retorna `hasContact=false`, antes de cair no `findPersonExpanded`, tentar `forcePopulateCachedPerson` primeiro (mesma cascata). Evita criar ghost no fluxo síncrono.
- Adicionar guarda de TLD: se `email` tem TLD inválido (ex.: `.TYPO`, ou não casa com `/^[a-z]{2,24}$/i` no último segmento), **não** enviar email para o PipeRun no PUT — só telefone. Stamp `raw_payload.email_invalid_tld=true` e log `lead_email_invalid_tld_skipped`.

**4. Endpoint manual de re-trigger**
- Aceitar `POST /piperun-person-empty-sweeper` com `{ lead_ids: [...] }` para reprocessar leads específicos (Vilmar e os outros 2 marcados hoje) sem precisar limpar o `unresolvable` flag manualmente. Quando `lead_ids` é passado, ignorar `empty_person_unresolvable=true`.

**5. Documentação `mem://architecture/empty-person-piperun-guard.md`**
- Adicionar a 4ª camada (`forcePopulateCachedPerson`) e a 5ª (`replace_silent_reject`).
- Documentar que email com TLD inválido (`.TYPO`, typos não corrigidos) entra em `email_invalid_tld` — sweeper não tenta corrigir, espera intervenção.

### Validação

1. Após deploy, chamar `POST /piperun-person-empty-sweeper` com `{ "lead_ids": ["185dbf9c-8b02-4eb1-9028-e5d6fec0f003","97814f87-...","422d5fe6-..."] }`.
2. Para Vilmar: como o email tem `.TYPO` (inválido), esperado: `piperun_person_invalid_email_tld` — lead permanece bloqueado mas com motivo claro. Se removermos manualmente o `.TYPO` antes (devolvendo `manicaodontologia@gmil.com`), ainda assim o domínio é inválido — mesma branch.
3. Para os outros 2: esperar `piperun_person_force_populated` ou `piperun_person_replaced_silent_reject`.
4. Conferir em `system_health_logs` os novos `error_type` e em `lia_attendances` que `pessoa_piperun_id` final tem contato (via curl `GET /persons/{id}`).

### Não faz parte

- Validador de domínio MX (ex.: detectar `gmil.com` como typo de `gmail.com` e auto-corrigir). Pode entrar depois como melhoria, mas exige cuidado para não corromper leads legítimos.
- Mudanças em `meta_webhook` ou `ingest-lead` — o problema é exclusivo do PipeRun PUT silencioso.
