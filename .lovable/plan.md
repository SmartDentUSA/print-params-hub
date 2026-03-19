

# Resposta: NÃO, os fallbacks não afetam leads com dados corretos

## Como funciona a proteção

Todos os 3 fallbacks propostos usam a condição **"se o mapa principal estiver vazio"**:

```text
if (Object.keys(productAggMap).length === 0 && ld.itens_proposta_parsed...)
if (Object.keys(sellerAggMap).length === 0 && ld.proprietario_lead_crm...)
if (Object.keys(mixMap).length === 0 && ld.itens_proposta_parsed...)
```

- **Leads novos** (com `proposals[].items[]` preenchido e `owner_name` no deal): os mapas já estão populados com SKU, valores e vendedor corretos. O fallback **nunca é ativado**.
- **Leads antigos** (sem proposals no snapshot, sem owner_name): os mapas ficam vazios, aí o fallback entra usando `itens_proposta_parsed` e `proprietario_lead_crm`.

O fallback de "Itens de Propostas" (linha 791) que já existe hoje segue a mesma lógica: `if (allProposalItems.length === 0 ...)`.

## Conclusão

A alteração é **segura** e **aditiva**. Leads atuais com SKU correto continuam exatamente como estão. Apenas leads antigos sem proposals detalhadas passam a exibir dados nos cards que hoje ficam vazios.

## Plano de implementação (sem mudanças ao aprovado anteriormente)

### Arquivo: `src/components/smartops/LeadDetailPanel.tsx`

1. **Após linha 628** — fallback `productAggMap` via `itens_proposta_parsed` (só se vazio)
2. **Após linha 644** — fallback `sellerAggMap` via `proprietario_lead_crm` (só se vazio)
3. **Após linha 728** — fallback `mixMap` via `itens_proposta_parsed` (só se vazio)

### Arquivo: `supabase/functions/import-proposals-csv/index.ts`
4. Adicionar `proprietario_lead_crm` no updatePayload

### Arquivo: `supabase/functions/_shared/piperun-field-map.ts`
5. Limpar prefixo `(id) PRO sigla` no `parseProposalItems`

Nenhuma dessas mudanças altera o fluxo principal — são apenas fallbacks condicionais e melhorias no parser para futuras importações.

