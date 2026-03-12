

# Plano: Corrigir Datas, Nome e Parsing de Propostas

## Problemas Identificados

### 1. Nome com timestamp
`Heloisa helena prats - 2025-09-17 19:48:37.078893-03:00` — o PipeRun envia `person.name` com timestamp anexado. A funcao `cleanPersonName()` existe em `piperun-field-map.ts` mas **nao e usada** no webhook.

**Locais afetados:**
- Linha 54: `personName: person?.name ? String(person.name) : null` (sem limpeza)
- Linha 378: `ids.personName` usado direto no insert
- Linha 541: `updateData.nome = ids.personName` usado direto no update

### 2. Datas incorretas
`data_primeiro_contato`, `entrada_sistema`, `created_at` = `2026-03-12T05:11:38` (hora da ingestao), mas `piperun_created_at` = `2025-09-17T19:48:37` (data real). O sistema deveria usar `piperun_created_at` como `data_primeiro_contato` e `entrada_sistema`.

### 3. Itens da proposta nao estratificados
`itens_proposta_crm` esta null. O webhook recebe `proposals[].items[]` mas nunca converte para texto pesquisavel. O `parseProposalItems` so roda quando o deal e "won" e so se `itens_proposta_crm` ja existir — ciclo vicioso.

## Correcoes

### Arquivo: `supabase/functions/smart-ops-piperun-webhook/index.ts`

**Fix 1 — cleanPersonName:** Importar e usar `cleanPersonName` do shared:
```typescript
// Linha 54: trocar
personName: person?.name ? cleanPersonName(String(person.name)) : null,
```
Tambem limpar no update (linha 541):
```typescript
if (ids.personName) updateData.nome = ids.personName; // ja limpo pelo extractIds
```

**Fix 2 — Datas:** No insert de novo lead (linha ~410), usar `piperun_created_at` como fonte:
```typescript
data_primeiro_contato: ids.dealCreatedAt || new Date().toISOString(),
entrada_sistema: ids.dealCreatedAt || new Date().toISOString(),
```

**Fix 3 — Proposals → itens_proposta_crm:** Apos `aggregateProposals`, gerar texto pesquisavel dos itens:
```typescript
if (ids.dealProposals?.length) {
  const itemTexts: string[] = [];
  for (const p of ids.dealProposals) {
    const items = (p as Record<string,unknown>).items as Array<Record<string,unknown>> | undefined;
    if (items) {
      for (const item of items) {
        const name = item.name || item.description || "";
        const qty = item.quantity || 1;
        if (name) itemTexts.push(`[${qty}] ${name}`);
      }
    }
  }
  if (itemTexts.length) {
    const rawText = itemTexts.join(", ");
    updateData.itens_proposta_crm = rawText;
    const parsed = parseProposalItems(rawText);
    updateData.itens_proposta_parsed = parsed.parsed;
  }
}
```

### Arquivo: `supabase/functions/_shared/piperun-field-map.ts`

Adicionar import de `cleanPersonName` na lista de exports (ja exporta, so precisa importar no webhook).

## Resumo de Mudancas

| Arquivo | Mudanca |
|---------|---------|
| `smart-ops-piperun-webhook/index.ts` | ~15 linhas: importar cleanPersonName, corrigir datas, gerar itens_proposta_crm dos proposals |

## Resultado

- Nomes limpos sem timestamp
- `data_primeiro_contato` e `entrada_sistema` refletem a data real do PipeRun
- Itens de proposta parseados e pesquisaveis desde a criacao do lead

