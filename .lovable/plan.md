## Diagnóstico objetivo

O problema ainda está ativo. Nos logs dos leads do print, o backend está tentando publicar e-mail/telefone, PipeRun responde `200`, mas a Pessoa continua com `emails_count=0` e `phones_count=0`.

Pior: quando o lead já tem `pessoa_piperun_id`, o fluxo atual valida esse ID procurando por e-mail/telefone. Como a Pessoa no PipeRun está vazia, a busca não acha contato e o sistema considera o ID “stale”, criando outra Pessoa nova. Isso gera Pessoas/Deals inconsistentes e cards sem vínculo útil.

Exemplos vistos agora:
- `julianachiode@gmail.com`: Pessoa mudou de `46907444` para nova Pessoa vazia `46907652`.
- `carolina@suprir.com.br`: Pessoa mudou para nova Pessoa vazia `46907655`.
- `sueniafaria@gmail.com`: Pessoa mudou para nova Pessoa vazia `46907650`.
- Logs: `piperun_email_silently_rejected` + `piperun_contact_still_missing_after_resync`.

## Plano de correção

### 1. Trocar a validação de Pessoa cacheada
Em `smart-ops-lia-assign`:
- Se `lead.pessoa_piperun_id` existe, validar com `GET /persons/{id}`.
- Não usar busca por e-mail/telefone para decidir se a Pessoa cacheada é inválida.
- Só criar nova Pessoa se o `GET /persons/{id}` falhar de verdade ou indicar remoção/inexistência.
- Se a Pessoa existe mas está sem contato, manter o ID e tentar republicar contato; nunca criar outra Pessoa por causa disso.

### 2. Criar trava forte contra Deal em Pessoa vazia
Depois de criar ou atualizar Pessoa:
- Verificar se o PipeRun realmente gravou pelo menos um identificador esperado: e-mail ou telefone.
- Se PipeRun retornar `200` mas a Pessoa continuar sem contato:
  - tentar localizar dono real por e-mail/telefone;
  - se achar, remapear o lead para esse dono;
  - se não achar, bloquear criação/atualização de Deal novo para essa Pessoa vazia e registrar o motivo.

Resultado esperado: o sistema pode falhar de forma segura, mas não cria mais Deal preso em Pessoa sem e-mail/telefone.

### 3. Corrigir o helper compartilhado de hierarquia PipeRun
Em `_shared/piperun-hierarchy.ts`:
- Aplicar a mesma regra de segurança de `createPerson` usada no fluxo principal.
- Bloquear Pessoa sem e-mail e sem telefone.
- Validar contato após criação.
- Evitar qualquer caminho paralelo que ainda possa criar Pessoa “só com nome”.

### 4. Melhorar leitura do webhook do PipeRun
Em `smart-ops-piperun-webhook`:
- Expandir extração de Pessoa para ler também:
  - `person.emails[].email`
  - `person.phones[].phone`
  - campos alternativos comuns do PipeRun.
- Isso evita que webhooks com contato em arrays sejam interpretados como “sem e-mail/telefone”.

### 5. Remediação dos leads afetados
Depois do deploy:
- Rodar a função de backfill/remediação para os registros com:
  - `piperun_contact_still_missing_after_resync`
  - `piperun_email_silently_rejected`
  - criados nas últimas 72h.
- Priorizar os leads visíveis no print e os logs recentes.
- Registrar no `system_health_logs` quais foram remapeados, corrigidos ou bloqueados.

### 6. Validação final
Validar por dados/logs que:
- nenhum lead novo com `piperun_id` fica com `pessoa_piperun_id` recém-criado e Pessoa vazia;
- os leads do print não continuam trocando para novas Pessoas vazias;
- novos eventos não geram mais `piperun_contact_still_missing_after_resync` em massa;
- `lia_attendances` mantém apenas leads canônicos (`merged_into is null`) no fluxo de CRM.