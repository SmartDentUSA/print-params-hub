

## Plano: Fluxo Anti-Duplicação com Hierarquia Pessoa → Empresa → Deal no PipeRun

### Situação Atual do Thiago Nicoletti no PipeRun

- **Pessoa** ID 27370319: `company_id = null` (sem empresa)
- **8 deals**, sendo 4 deletados e 4 ativos:
  - Deal 42417219: Estagnados, aberto, owner Paulo Sérgio
  - Deal 38508829: Vendas, congelado, owner Patricia
  - Deal 33706074: Estagnados, aberto, owner Thiago Nicoletti (gestor)
  - Deal 54512402: CS Onboarding, deletado
- **Nenhum deal ganho** (status=1), **nenhuma empresa associada**

### Problema

O sistema atual ignora a estrutura hierárquica do PipeRun (Pessoa → Empresa → Deal). Cria deals sem verificar se a pessoa já existe, se tem empresa, ou se já tem deals abertos/ganhos — gerando duplicatas.

### Novo Fluxo no `smart-ops-lia-assign/index.ts`

Reescrever a seção 6 (Sync with PipeRun) com a seguinte lógica:

```text
1. Buscar Pessoa por email no PipeRun (GET /persons?email=X)
   ├─ Não existe → Criar Pessoa → Criar Empresa → Criar Deal no Funil de Vendas
   └─ Existe (person_id) →
       2. Verificar company_id da pessoa
          ├─ Sem empresa → Criar Empresa com dados da pessoa → Associar à pessoa (PUT /persons/{id})
          └─ Com empresa → OK
       3. Buscar deals da pessoa (GET /deals?person_id=X&show=50)
          → Filtrar apenas não-deletados (deleted=0)
          → Separar em:
             - deals_ganhos (status=1): NÃO TOCAR
             - deals_abertos (status=0):
               ├─ Algum no Funil de Vendas (18784)? → Atualizar esse deal (owner, custom fields, nota)
               ├─ Nenhum no Vendas, mas tem em Estagnados (72938)?
               │   → Mover para Funil de Vendas, stage "Sem Contato"
               │   → Atualizar owner com vendedor ativo (round robin)
               │   → Adicionar nota "Reativado pela Dra. L.I.A."
               └─ Nenhum aberto relevante?
                   → Criar novo Deal no Funil de Vendas
```

### Mudanças Técnicas

#### 1. Nova função `findPersonDeals` no `lia-assign`

```typescript
async function findPersonDeals(apiToken: string, personId: number) {
  const res = await piperunGet(apiToken, "deals", { person_id: personId, show: 50 });
  if (!res.success || !res.data) return [];
  const items = (res.data as any).data as any[] || [];
  return items.filter((d: any) => d.deleted !== 1); // Ignorar deletados
}
```

#### 2. Nova função `findOrCreateCompany`

```typescript
async function findOrCreateCompany(apiToken: string, personId: number, lead: Record<string, unknown>): Promise<number | null> {
  // Verificar se pessoa já tem company_id
  const personRes = await piperunGet(apiToken, `persons/${personId}`);
  const person = (personRes.data as any)?.data;
  if (person?.company_id) return person.company_id;
  
  // Criar empresa com dados da pessoa
  const companyPayload = {
    name: lead.nome || lead.email,
    emails: lead.email ? [{ email: lead.email }] : [],
    phones: (lead.telefone_normalized || lead.telefone_raw) ? [{ phone: lead.telefone_normalized || lead.telefone_raw }] : [],
  };
  const createRes = await piperunPost(apiToken, "companies", companyPayload);
  const companyId = (createRes.data as any)?.data?.id;
  
  if (companyId) {
    // Associar empresa à pessoa
    await piperunPut(apiToken, `persons/${personId}`, { company_id: companyId });
    return companyId;
  }
  return null;
}
```

#### 3. Reescrever seção 6 do handler principal

Substituir o bloco `if (isExisting && piperunId) { ... } else { ... }` (linhas 259-322) pela nova lógica:

```typescript
// ── 6. Smart PipeRun Sync: Pessoa → Empresa → Deal ──
const personId = await findOrCreatePerson(PIPERUN_API_KEY, lead);
let companyId: number | null = null;
let piperunId = lead.piperun_id;

if (personId) {
  // Garantir empresa associada
  companyId = await findOrCreateCompany(PIPERUN_API_KEY, personId, lead);
  
  // Buscar deals existentes (não-deletados)
  const allDeals = await findPersonDeals(PIPERUN_API_KEY, personId);
  const openDeals = allDeals.filter(d => d.status === 0);
  const wonDeals = allDeals.filter(d => d.status === 1);
  
  // Deals ganhos: NUNCA TOCAR
  if (wonDeals.length > 0) {
    console.log(`[lia-assign] ${wonDeals.length} won deals found — preserving`);
  }
  
  // Procurar deal aberto no Funil de Vendas
  const vendaDeal = openDeals.find(d => d.pipeline_id === PIPELINES.VENDAS && !d.freezed);
  // Procurar deal aberto em Estagnados
  const estagnDeal = openDeals.find(d => d.pipeline_id === PIPELINES.ESTAGNADOS);
  
  if (vendaDeal) {
    // Já tem deal aberto no Vendas → apenas atualizar
    piperunId = String(vendaDeal.id);
    // Atualizar owner, custom fields, nota
    await updateExistingDeal(PIPERUN_API_KEY, vendaDeal.id, assignedOwnerId, customFields, lead);
  } else if (estagnDeal) {
    // Tem deal em Estagnados → mover para Vendas
    piperunId = String(estagnDeal.id);
    await moveDealToVendas(PIPERUN_API_KEY, estagnDeal.id, assignedOwnerId, stage_id, customFields, lead);
  } else {
    // Nenhum deal relevante → criar novo no Vendas
    piperunId = await createNewDeal(PIPERUN_API_KEY, personId, companyId, lead, pipeline_id, stage_id, assignedOwnerId, customFields, email);
  }
}
```

#### 4. Salvar `pessoa_piperun_id` e `empresa_piperun_id` no `lia_attendances`

Atualizar os campos existentes na tabela (já existem as colunas `pessoa_piperun_id` e `empresa_piperun_id`):

```typescript
updateFields.pessoa_piperun_id = personId;
if (companyId) updateFields.empresa_piperun_id = companyId;
```

#### 5. Priorizar vendedor com WaLeads no `pickRandomActiveVendedor`

```typescript
async function pickRandomActiveVendedor(supabase): Promise<TeamMember> {
  // Primeiro: vendedores com WaLeads ativo
  const { data: waMembers } = await supabase
    .from("team_members")
    .select("id, nome_completo, piperun_owner_id")
    .eq("ativo", true)
    .eq("role", "vendedor")
    .not("waleads_api_key", "is", null);

  if (waMembers?.length) {
    return waMembers[Math.floor(Math.random() * waMembers.length)];
  }
  
  // Fallback: qualquer vendedor ativo
  const { data: members } = await supabase
    .from("team_members")
    .select("id, nome_completo, piperun_owner_id")
    .eq("ativo", true)
    .eq("role", "vendedor");

  if (!members?.length) {
    return { id: "fallback-admin", nome_completo: "Thiago Nicoletti", piperun_owner_id: FALLBACK_OWNER_ID };
  }
  return members[Math.floor(Math.random() * members.length)];
}
```

### Arquivo alterado

| Arquivo | Mudança |
|---|---|
| `supabase/functions/smart-ops-lia-assign/index.ts` | Reescrita completa da seção de sync PipeRun: findPersonDeals, findOrCreateCompany, lógica de decisão ganho/aberto/estagnado/novo, priorização WaLeads, salvar pessoa_piperun_id e empresa_piperun_id |

### Fluxo esperado para Thiago Nicoletti após correção

```text
1. Busca pessoa 27370319 → encontrada
2. company_id = null → cria empresa "Thiago Nicoletti" com email/telefone
3. Busca deals → 4 ativos (0 ganhos, 4 abertos)
4. Nenhum no Funil de Vendas (não-freezed) → deal 42417219 (Estagnados) → mover para Vendas
5. Sortear vendedor com WaLeads ativo (Patrica Silva)
6. Atualizar owner para Patrica, stage "Sem Contato", adicionar nota
7. Salvar pessoa_piperun_id=27370319, empresa_piperun_id=novo_id
8. Disparar mensagem vendedor→lead via WaLeads
```

