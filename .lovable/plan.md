

# Plano: Corrigir Mapeamento do Webhook PipeRun

## Problema

Comparando o payload real do PipeRun (que o usuario enviou) com o `extractIds()` no webhook, existem **7 mapeamentos incorretos** que causam perda de dados:

| Campo | Payload real | Codigo atual | Resultado |
|-------|-------------|-------------|-----------|
| Email pessoa | `person.contact_emails[0].address` | `person.email` | null |
| Telefone pessoa | `person.contact_phones[0].number` | `person.phone` / `person.mobile` | null |
| Cidade pessoa | `person.city.name` | OK | funciona |
| UF pessoa | `person.city.uf` | `person.state.initials` | null |
| Segmento empresa | `company.segment.name` (objeto) | `String(company.segment)` | "[object Object]" |
| Cidade empresa | `company.city.name` | OK | funciona |
| UF empresa | `company.city.uf` | `company.state.abbr` | null |
| Situacao empresa | `company.company_situation` | `company.situation` | null |
| Motivo perda descricao | `lost_reason.description` | `lossReason.comment` | null |
| Telefone empresa | `company.contact_phones[0].number` | `company.phones[0].phone` | null |
| Email empresa | `company.contact_emails[0].address` | `company.emails[0].email` | null |
| Endereco empresa | `company.address_street`, `address_number`, `district`, `address_postal_code` | `company.address` (objeto nested) | parcial |

## Implementacao

### Arquivo: `supabase/functions/smart-ops-piperun-webhook/index.ts`

Corrigir `extractIds()` para aceitar **ambos** os formatos (API list e webhook):

```typescript
// Person email: cascade
personEmail: (() => {
  // Webhook: contact_emails array
  const emails = person?.contact_emails as Array<{address?: string}> | undefined;
  if (emails?.[0]?.address) return String(emails[0].address);
  // API list: person.email
  if (person?.email) return String(person.email);
  return null;
})(),

// Person phone: cascade  
personPhone: (() => {
  const phones = person?.contact_phones as Array<{number?: string}> | undefined;
  if (phones?.[0]?.number) return String(phones[0].number);
  if (person?.phone) return String(person.phone);
  if (person?.mobile) return String(person.mobile);
  return null;
})(),

// Person UF: city.uf fallback
personState: (() => {
  const city = person?.city as Record<string,unknown> | undefined;
  if (city?.uf) return String(city.uf);
  const state = person?.state as Record<string,unknown> | undefined;
  return state?.abbr ? String(state.abbr) : (state?.initials ? String(state.initials) : (state?.name ? String(state.name) : null));
})(),

// Company segment: object.name
companySegment: (() => {
  const seg = company?.segment;
  if (!seg) return null;
  if (typeof seg === "object" && (seg as Record<string,unknown>).name) return String((seg as Record<string,unknown>).name);
  return String(seg);
})(),

// Company UF: city.uf fallback
companyState: (() => {
  const city = company?.city as Record<string,unknown> | undefined;
  if (city?.uf) return String(city.uf);
  const state = company?.state as Record<string,unknown> | undefined;
  return state?.abbr ? String(state.abbr) : null;
})(),

// Company situation
companySituacao: company?.company_situation ? String(company.company_situation) : (company?.situation ? String(company.situation) : null),

// Company phones/emails
companyPhone: (() => {
  const phones = company?.contact_phones as Array<{number?: string}> | undefined;
  if (phones?.[0]?.number) return String(phones[0].number);
  const oldPhones = company?.phones as Array<{phone?: string}> | undefined;
  return oldPhones?.[0]?.phone ? String(oldPhones[0].phone) : null;
})(),
companyEmail: (() => {
  const emails = company?.contact_emails as Array<{address?: string}> | undefined;
  if (emails?.[0]?.address) return String(emails[0].address);
  const oldEmails = company?.emails as Array<{email?: string}> | undefined;
  return oldEmails?.[0]?.email ? String(oldEmails[0].email) : null;
})(),
```

### Arquivo: `supabase/functions/_shared/piperun-field-map.ts`

Aplicar as mesmas correcoes no `PipeRunDealData` interface e `mapDealToAttendance()` para que o sync full tambem funcione com o formato correto.

### Correcao adicional no motivo de perda

No handler principal, corrigir:
```typescript
// Antes:
if (lossReason?.comment) updateData.comentario_perda = ...
// Depois:
if (lossReason?.description) updateData.comentario_perda = ...
```

### Endereco empresa (novo campo flat)

Capturar os campos flat do payload (`address_street`, `address_number`, `district`, `address_postal_code`, `address_complement`) alem do objeto `address` nested, pois o webhook envia ambos.

## Arquivos modificados

| Arquivo | Mudanca |
|---------|---------|
| `smart-ops-piperun-webhook/index.ts` | ~40 linhas: corrigir extractIds() com cascades para ambos formatos |
| `_shared/piperun-field-map.ts` | ~20 linhas: corrigir mapDealToAttendance() e interface |

## Resultado

Todos os 12 campos que estavam sendo perdidos passarao a ser capturados corretamente, tanto via webhook quanto via sync full, independente do formato do payload.

