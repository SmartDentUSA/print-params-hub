## Objetivo
1. Garantir que o Deal seja **sempre** criado, sem depender da leitura `GET /persons/{id}` (que está retornando vazio mesmo para pessoas válidas).
2. Persistir os custom fields fornecidos (PESSOA e DEAL) usando o formato `fields:[{id,valor}]` confirmado pela API do PipeRun.

## Arquivo único alterado
`supabase/functions/smart-ops-lia-assign/index.ts`

### Parte 1 — Remover guard de pessoa vazia

**a) Bloco lines 2189–2230** (`// ── EMPTY-PERSON GUARD ──`): remover por completo. `createNewDeal(...)` passa a ser chamado direto após o `if (!piperunId)`, sem GET prévio nem early-return.

**b) Bloco lines 479–498** (`verifyAndRecoverPersonContact` no fim de `updatePersonFields`): remover o `try/catch` inteiro. Esse helper também depende do GET vazio e gera ruído nos logs. Manter o auditoria positiva (`piperun_person_contact_published`) que já existe acima.

**c) Bloco lines 1947–1974** dentro da branch `if (!cachedCheck.hasContact)`: remover a chamada `forcePopulateCachedPerson` (e todo o `try/catch` de "force populate cached"). Manter o restante (swap por `findPersonExpanded`) intocado — ele é independente do guard e pode ainda ajudar a evitar duplicatas.

**d)** O guard `crm_creation_blocked='missing_identifiers'` (linha 205) **permanece** — ele bloqueia só quando o lead não tem nem email nem telefone, regra de negócio explícita na memória core e diferente do problema atual.

### Parte 2 — Custom fields PESSOA + DEAL

Inserir um único bloco **após** `createNewDeal` (após o atual `// ── Step 5h: POST-DEAL VERIFY & RESYNC ──`, ~linha 2280, dentro do `if (piperunId && personId)`), substituindo a parte que hoje só faz `updatePersonFields` + verify.

Pseudocódigo (TS exato será aplicado na build):

```ts
const CF_PESSOA = {
  area_atuacao: 673900, especialidade: 445631, tem_impressora: 546566,
  mapeamento_scanner: 772727, mapeamento_impressora: 772728, origem_lead: 772511,
};
const CF_DEAL = {
  area_atuacao: 549241, especialidade: 549059, produto_interesse: 549058,
  tem_impressora: 549243, produto_auto: 549148,
};

const formName = String(lead.form_name || "").trim();
const email = (lead.email as string | null) || null;
const phoneDigits = String(lead.telefone_normalized || lead.telefone_raw || "").replace(/\D/g, "");
const leadAreaAtuacao = lead.area_atuacao as string | null;
const leadEspecialidade = lead.especialidade as string | null;
const leadTemImpressora = String(lead.tem_impressora || "").toLowerCase();
const leadModeloScanner = (lead.como_digitaliza as string | null) || (lead.equip_scanner as string | null);
const leadModeloImpressora = lead.impressora_modelo as string | null;

// PESSOA
const personFields: Array<{id:number; valor:string}> = [];
if (leadAreaAtuacao)    personFields.push({ id: CF_PESSOA.area_atuacao, valor: leadAreaAtuacao.toUpperCase() });
if (leadEspecialidade)  personFields.push({ id: CF_PESSOA.especialidade, valor: leadEspecialidade });
if (leadTemImpressora)  personFields.push({ id: CF_PESSOA.tem_impressora, valor: leadTemImpressora === "sim" ? "SIM" : "NÃO" });
if (leadModeloScanner && !["ainda_não_digitalizo","sem scanner"].includes(leadModeloScanner.toLowerCase()))
                        personFields.push({ id: CF_PESSOA.mapeamento_scanner, valor: leadModeloScanner });
if (leadModeloImpressora && !["não tem","sem impressora"].includes(leadModeloImpressora.toLowerCase()))
                        personFields.push({ id: CF_PESSOA.mapeamento_impressora, valor: leadModeloImpressora });
if (formName)           personFields.push({ id: CF_PESSOA.origem_lead, valor: `Meta Lead Ads — ${formName}` });

if (personId && (personFields.length > 0 || email || phoneDigits)) {
  const payload: Record<string, unknown> = {};
  if (personFields.length) payload.fields = personFields;
  if (email)        { payload.contact_emails = [{ address: email }]; payload.emails = [{ email }]; }
  if (phoneDigits)  { payload.contact_phones = [{ number: phoneDigits, is_main: 1 }]; payload.phones = [{ phone: phoneDigits }]; payload.cellphone = phoneDigits; }
  await piperunPut(PIPERUN_API_KEY, `persons/${personId}`, payload)
    .catch(e => console.warn("[lia-assign] person fields PUT:", (e as Error).message));
}

// DEAL
if (piperunId) {
  const dealFields: Array<{id:number; valor:string}> = [];
  if (leadAreaAtuacao)   dealFields.push({ id: CF_DEAL.area_atuacao, valor: leadAreaAtuacao });
  if (leadEspecialidade) dealFields.push({ id: CF_DEAL.especialidade, valor: leadEspecialidade });
  if (lead.produto_interesse) dealFields.push({ id: CF_DEAL.produto_interesse, valor: String(lead.produto_interesse) });
  if (leadTemImpressora) dealFields.push({ id: CF_DEAL.tem_impressora, valor: leadModeloImpressora ? `${leadTemImpressora} - ${leadModeloImpressora}` : leadTemImpressora });
  if (dealFields.length) {
    await piperunPut(PIPERUN_API_KEY, `deals/${piperunId}`, { fields: dealFields })
      .catch(e => console.warn("[lia-assign] deal fields PUT:", (e as Error).message));
  }
}
```

O bloco antigo do "Step 5h verify" (`piperunGet` + `system_health_logs piperun_person_card_blank_after_resync`) é **substituído** por este novo bloco. `updatePersonFields` continua sendo chamado antes, ele cobre o restante (job_title, cpf, etc).

## O que NÃO mudar
- `Person Creation Integrity` (precisa email OU phone), debounce 60s, Commercial Intent Guard, Person Origin Frozen — tudo permanece.
- Sweeper `piperun-person-empty-sweeper` será mantido como está (sem cron mudou nada hoje); pode ser revisitado depois.
- `_shared/piperun-person-resolver.ts` — não é alterado nesta tarefa (helpers `forcePopulate` / `verifyAndRecover` ficam disponíveis mas sem callers).

## Backfill imediato após deploy
1. SQL: `UPDATE lia_attendances SET crm_creation_blocked=false, crm_creation_blocked_reason=NULL WHERE crm_creation_blocked_reason='empty_person_in_piperun' AND created_at > now() - interval '36 hours';`
2. Disparar `smart-ops-lia-assign` para os 12 lead_ids bloqueados de hoje (Letícia, Luanna, Ricardo, Kathleen, Evandro, Patrícia, Soraya, Roseany, Anna, Vitória, Vanessa, Helena).
3. Confirmar via SQL que cada um recebeu `crm_id` (Deal) e `proprietario`.

## Memória
Atualizar `mem://architecture/empty-person-piperun-guard.md` marcando o guard como **desativado** — Deal deve ser sempre criado; a verificação por GET retornava falsos positivos. Adicionar nota sobre o formato `fields:[{id,valor}]` para custom fields de Person/Deal.