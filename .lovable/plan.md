## Diagnóstico

O lead **Nilson Carlos da Silva Junior / florianopolis.sorrisofloripa@hotmail.com** (deal PipeRun **57764817**, pipeline "CS Onboarding", empresa SORRISO FLORIPA CLINICAS ODONTOLOGICAS) **nunca foi criado em `lia_attendances`**.

O `piperun-webhook` recebeu o evento **11+ vezes** desde 26/mai (último hoje 17:11) e em todas registrou:

- `outcome = skipped_no_email`
- `error = deal_without_email_after_hydration`

Inspecionando o `raw_payload` do evento mais recente (id 13831):

- `deal.person.contact_emails` = **vazio** (Pessoa "Nilson Carlos…" no PipeRun não tem email cadastrado)
- `deal.person.contact_phones` = **vazio**
- `deal.company.contact_emails[0].address` = `florianopolis.sorrisofloripa@hotmail.com` ✅
- `deal.company.contact_phones[0].number` = `554833648633` ✅
- `deal.company.company_name` = `FLORIANOPOLIS - SORRISO FLORIPA CLINICAS ODONTOLOGICAS LTDA`
- `deal.company.cnpj` = `59.124.426/0001-08`

O extractor (`smart-ops-piperun-webhook/index.ts:62-77`) já lê `companyEmail` e `companyPhone`, mas o handler de auto-create (linha 465 / 512) só considera `personEmail`. Como o email existe **só na empresa**, o guard aborta antes de criar o lead.

Isso afeta todos os deals do CS Onboarding cuja Person foi criada vazia (padrão comum em deals criados a partir da empresa).

## Mudança proposta

Arquivo único: `supabase/functions/smart-ops-piperun-webhook/index.ts`

1. **Cascade de email** (linha 465): se `personEmail` for nulo, usar `ids.companyEmail` como fallback.
2. **Cascade de telefone** (linha 466 e 521): se `ids.personPhone` for nulo, usar `ids.companyPhone` como fallback (tanto na normalização para `findLeadByCascade` quanto no `validateLeadIdentity`).
3. Marcar no log/`raw_payload` que o contato veio da empresa (campo `identity_source: "company_fallback"` nos logs `console.log`), para não confundir auditoria.
4. **Não alterar** o `validateLeadIdentity` — ele continua exigindo nome+email+telefone reais; só passamos a alimentá-lo com os dados da empresa quando a pessoa estiver vazia.

Reprocessamento do deal 57764817:
- O PipeRun continua disparando o webhook a cada mudança de etapa, então a próxima entrega já entrará no fluxo novo.
- Para destravar imediatamente sem esperar nova entrega, depois do deploy chamamos `supabase--curl_edge_functions` no `smart-ops-piperun-webhook` com o `raw_payload` do evento 13831 (re-injetar manualmente). Opcional — confirmo com você se quer fazer isso na hora.

## Fora do escopo

- Não mexer no `smart-ops-sync-piperun` (sync periódico) — ele tem lógica própria de skip e não é a fonte deste lead.
- Não alterar regras de Person Origin nem Commercial Intent Guard — CS Onboarding é pipeline protegido e continua fora da régua VENDAS.
- Não criar memory novo (a regra "fallback empresa→pessoa" é caso particular do extractor, não política global).

## Detalhes técnicos

```ts
// linha ~465
const personEmail =
  ids.personEmail ||
  ((deal.person as Record<string, unknown>)?.email
    ? String((deal.person as Record<string, unknown>).email)
    : null) ||
  ids.companyEmail; // NEW

const personPhoneEffective = ids.personPhone || ids.companyPhone; // NEW
const phoneNormalizedForCascade = normalizeBrazilianPhone(personPhoneEffective);
```

E nas linhas 521/528/536/567/746-748 trocar `ids.personPhone` por `personPhoneEffective`.
