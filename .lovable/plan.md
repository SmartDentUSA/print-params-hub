## Diagnóstico

Testei com o deal `60023435` (Fabio Teixeira, criado 19:56Z hoje). O form Meta entregou rico `form_data` (`produto_interesse=BLZ Ino200`, `tem_impressora=não`, `tem_scanner=não`, `area_atuacao=Clínica ou Consultório`, `como_digitaliza=Ainda não digitalizo`), mas:

- **Card da Pessoa no PipeRun**: ficou com **0 custom fields**. Log confirma: `Creating person: Fabio Teixeira | origin="BLZ- Smart Dent" | 0 custom fields`.
- **Card do Deal no PipeRun**: o `lia-assign` ENVIA 6 CFs (`Enriching new deal 60023435 with 6 custom fields` → `PUT: true (200)`), mas a coluna espelho `lia_attendances.piperun_custom_fields` está `[]`, ou seja, não temos auditoria local do que foi para o CRM.

### Causa raiz (3 bugs distintos)

1. **Pessoa não recebe NENHUM custom field** — `smart-ops-lia-assign/index.ts` linhas 312–315 zeraram `personCustomFields` por uma rejeição 422 antiga (IDs 674001/674002). O array é hardcoded `[]`, então Área/Especialidade/Produto/WhatsApp nunca vão ao card da Pessoa. O `piperun-field-map.ts` (`buildPersonCustomFieldsHash`) existe e está validado, mas nunca é chamado no fluxo de criação.

2. **`updatePersonFields` também não envia CFs no fluxo principal** — após criar a Pessoa, o lia-assign atualiza nome/email/telefone/cargo (linha 2074 "Step 5b"), mas o payload de `custom_fields` está vazio pelo mesmo motivo. Confirmado nos logs: `Updating person 47146309: {...job_title...}` sem `custom_fields`.

3. **`createNewDeal` não persiste o snapshot local** — em `index.ts:715-766`, depois do PUT bem-sucedido com 6 CFs ao PipeRun, **falta** o `supabase.update({ piperun_custom_fields })` que existe no `updateExistingDeal` (linha 660). Resultado: o card do PipeRun fica certo, mas no nosso lado a coluna fica vazia — induz a achar que "não foi". Para deals atualizados (não criados) o snapshot é gravado normalmente.

## Plano de correção

### 1. Reabilitar custom fields na Pessoa (createPerson)
Em `supabase/functions/smart-ops-lia-assign/index.ts` (linhas 311–317):

- Remover o `personCustomFields = []` hardcoded.
- Construir o array usando o resolver já existente (`buildPersonCustomFieldsHash` de `piperun-field-map.ts`), convertendo para o shape `[{ custom_field_id, value }]` que o `piperunPost(persons, ...)` espera (`{ custom_fields: [{id, value}] }`).
- Mapear no mínimo: WhatsApp, Área de Atuação, Especialidade, Produto de Interesse, Tem Scanner, Tem Impressora, País.
- Manter o fallback de 422 (linhas 328–339) que já remove `custom_fields` e reenvia — isso protege caso algum ID volte a quebrar; o deal continua sendo o ground-truth.

### 2. Enviar custom fields na atualização da Pessoa
No "Step 5b" (`index.ts` ~linha 2074, dentro de `updatePersonFields`):
- Adicionar `custom_fields` derivados dos mesmos campos do passo 1 ao payload do PUT `/persons/{id}`. Isso garante que pessoas pré-existentes (cenário comum) também recebam os dados do form.

### 3. Persistir snapshot `piperun_custom_fields` quando deal é CRIADO
Em `createNewDeal` (`index.ts` ~linha 757, logo após o `enrichRes` retornar success):

```ts
if (enrichRes.success && cfPayload.length > 0) {
  await supabase
    .from("lia_attendances")
    .update({ piperun_custom_fields: customFields })
    .eq("id", lead.id as string);
}
```

Espelhando exatamente o bloco que já existe em `updateExistingDeal` linhas 660–668.

### 4. Validação pós-deploy
- Reprocessar o lead `cdb36864-399e-4578-a546-f1980234f72a` (Fabio Teixeira / deal 60023435) chamando `smart-ops-lia-assign` manualmente.
- Conferir no card PipeRun:
  - Pessoa 47146309: Área, Especialidade, Produto, WhatsApp preenchidos.
  - Deal 60023435: CFs já estão lá; confirmar que `lia_attendances.piperun_custom_fields` agora reflete o que foi enviado.
- Acompanhar logs por 422 em `persons` — se aparecer, o fallback strip já cobre.

### Detalhes técnicos
- Nenhuma alteração de schema. Tudo no edge function `smart-ops-lia-assign`.
- O resolver de `form_data` (`mapAttendanceToDealCustomFields`) trata a race condition entre `dynamic-lead-ingestion` e `lia-assign`; reuso a mesma lógica de fallback `form_data → top-level` para a Pessoa, criando helper compartilhado.
- Não muda regras de Commercial Intent Guard, origem da Pessoa congelada, nem o sanitizador embed-update — apenas o conteúdo do payload `custom_fields`.

### Fora de escopo
- Erros de schema cache `piperun_person_mismatch` em `sync-piperun` / `piperun-full-sync` (column missing) — são outro bug, não estão bloqueando o card; trato em chamada separada se quiser.
- Bug PostgREST de `embed-update` (já mitigado pelo sanitizer).
