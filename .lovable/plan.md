

## Diagnóstico Completo — PipeRun + WaLeads

### Estado Atual no PipeRun

| Item | Valor | Status |
|------|-------|--------|
| Pessoa 27370319 | `company_id: 22348229` | ✅ Empresa vinculada |
| Empresa 22348229 | `name: "Thiago"` (incompleto), sem emails, sem phones | ⚠️ Dados mínimos |
| Deal 42417219 | `pipeline_id: 18784` (Vendas), `stage_id: 99293` (Sem Contato) | ✅ Funil correto |
| Deal 42417219 | `owner_id: 47675` (Patrica Silva) | ✅ Owner correto |
| Deal 42417219 | `company_id: null` | ❌ Empresa NÃO vinculada ao deal |
| Deal 42417219 | `value: null`, custom_fields não retornados | ❌ Campos faltando |
| Deal 42417219 | `person_id: 27370319` | ✅ Pessoa vinculada |

### Problemas Identificados

**1. Deal sem `company_id`**: A função `updateExistingDeal` faz `PUT /deals/{id}` mas NÃO inclui `company_id` no payload. Só envia `owner_id`, `origin_id` e custom fields via hash. O `companyId` calculado pelo fluxo nunca chega ao deal existente.

**2. Empresa com dados mínimos**: A empresa foi criada com `name: "Thiago"` (apenas primeiro nome do `lead.nome`), sem email e sem telefone. O `findOrCreateCompany` usa `lead.nome || lead.email` mas o `lead.nome` era "Thiago" (curto).

**3. Custom fields não persistindo no deal update**: O `with[]=custom_fields` não retornou campos customizados. Possível problema no formato do hash map para PUT.

**4. Mensagens WaLeads**: API retornou `201 + MESSAGE_SENT` em ambas as chamadas. O código está correto — se as mensagens não chegaram no dispositivo, o problema é no WaLeads (dispositivo offline ou fila de envio).

### Plano de Correção

#### 1. `updateExistingDeal` — incluir `company_id`

Adicionar `company_id` ao payload de update quando disponível:

```typescript
async function updateExistingDeal(
  apiToken, dealId, ownerId, customFields, lead,
  companyId?: number | null  // novo parâmetro
) {
  const updatePayload = {
    owner_id: ownerId,
    origin_id: ORIGINS.DRA_LIA.id,
    ...hashFields,
  };
  if (companyId) updatePayload.company_id = companyId;  // FIX
  // ...
}
```

E passar `companyId` nas chamadas em `updateExistingDeal` e `moveDealToVendas`.

#### 2. `findOrCreateCompany` — dados completos

Usar `lead.nome` completo (não apenas primeiro nome), incluir email e telefone reais:

```typescript
const nome = (lead.nome as string || lead.email || "Empresa Lead");
// Garantir que emails/phones são passados corretamente
if (email) companyPayload.emails = [{ email }];
if (phone) companyPayload.phones = [{ phone }];
```

Também atualizar a empresa existente (22348229) com os dados corretos via PUT.

#### 3. Custom fields — verificar formato no update

O `customFieldsToHashMap` converte para `{ hash: value }`. Verificar se o PUT está de fato enviando esses campos. Adicionar log do payload enviado.

#### 4. Adicionar `sendWaLeadsMessage` — log da resposta

Atualmente o `sendWaLeadsMessage` faz fire-and-forget sem ler a resposta. Adicionar `await res.json()` e log para rastrear falhas.

### Arquivos alterados

| Arquivo | Mudança |
|---|---|
| `supabase/functions/smart-ops-lia-assign/index.ts` | `updateExistingDeal` + `moveDealToVendas` recebem `companyId`, `findOrCreateCompany` com dados completos, `sendWaLeadsMessage` loga resposta |

### Resultado esperado após correção

```text
Deal 42417219:
  company_id: 22348229 ✅ (era null)
  custom_fields: especialidade, produto_interesse, whatsapp preenchidos
  
Empresa 22348229:
  name: "Thiago Nicoletti" (completo)
  emails: [thiago.nicoletti@smartdent.com.br]
  phones: [5516997322333]
```

