

## Plano: Corrigir extração de email/telefone no sync PipeRun

### Problema
O `mapDealToAttendance` espera `person.emails[]` e `person.phones[]`, mas a API `/deals?with[]=person` retorna a pessoa **sem** esses arrays. O email real está em `deal.reference` / `deal.rdstation_reference`, e o telefone pode estar no deal, na pessoa vinculada ou na organização.

### Etapas

#### 1. Investigar estrutura real da API PipeRun
Chamar `piperun-api-test` com `action=get_deal` (que usa `with=items,persons,companies`) para um deal real e mapear onde estão:
- `deal.reference` (email)
- `deal.person.phones`
- `deal.company.phones`
- `deal.person.emails`
- custom field WHATSAPP (549150)

#### 2. Atualizar `PipeRunDealData` no `piperun-field-map.ts`
Adicionar campos faltantes ao tipo:
```typescript
export interface PipeRunDealData {
  // ... existentes ...
  reference?: string;
  rdstation_reference?: string;
  title?: string;
  company?: {
    name?: string;
    phones?: Array<{ phone: string }>;
    emails?: Array<{ email: string }>;
  };
}
```

#### 3. Atualizar `mapDealToAttendance` com cascata de extração

**Email** (prioridade):
1. `person.emails[0].email` (webhook)
2. `deal.reference` (API)
3. `deal.rdstation_reference` (fallback)

**Nome** (prioridade):
1. `person.name`
2. `deal.title`

**Telefone** (prioridade):
1. `person.phones[0].phone`
2. `company.phones[0].phone` (organização)
3. Custom field WHATSAPP (549150) — já existe como fallback

#### 4. Atualizar params do sync para incluir `company`
No `smart-ops-sync-piperun`, mudar `"with[]": "person"` para incluir também a organização (testar se a API aceita múltiplos `with[]`).

#### 5. Re-deploy e testar sync completo
Rodar `?full=true` e validar que `skippedNoData` cai para perto de zero.

### Arquivos afetados
- `supabase/functions/_shared/piperun-field-map.ts` — tipo + `mapDealToAttendance`
- `supabase/functions/smart-ops-sync-piperun/index.ts` — params da API

