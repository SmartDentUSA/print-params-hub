

# Fix: Itens de propostas abertas não visíveis

## Causa raiz

O código em `LeadDetailPanel.tsx` (linha 505) itera `allDeals` (de `piperun_deals_history`) e lê `d.proposals` de cada deal. Para deals abertos, esse array é `[]`. Porém, os dados ricos das propostas estão em `ld.proposals_data` (nível do lead) — campo que o código **nunca lê**.

O fallback (linha 828) usa `itens_proposta_parsed`, que tem apenas nome+qty sem valores financeiros.

## Dados reais (Ana Clara)

- `piperun_deals_history[0].proposals` → `[]` ❌
- `proposals_data[0].items[0]` → `{name: "INO 200 - BLZ", value: 59990, code: "1796"}` ✅
- `itens_proposta_parsed` → `[{name: "INO 200 - BLZ", qty: 1}]` (sem valor)

## Correção

**Arquivo**: `src/components/smartops/LeadDetailPanel.tsx`

Após o loop principal (linha 505-539), adicionar um segundo passo que injeta `ld.proposals_data` quando os deals não têm proposals embutidos:

```
// Após linha 539:
// Cross-reference: deals sem proposals embutidos → buscar em ld.proposals_data
if (allProposalItems.length === 0 && Array.isArray(ld.proposals_data) && ld.proposals_data.length > 0) {
  (ld.proposals_data as any[]).forEach((prop: any) => {
    const items = (Array.isArray(prop.items) ? prop.items : []).filter(isValidItem);
    const dealId = String(prop.deal_id || ld.piperun_id || "—");
    const propId = String(prop.id || prop.hash || "—");
    if (items.length > 0) {
      items.forEach((item: any) => {
        const qty = Number(item.quantity || item.qtd || 1);
        const unitVal = Number(item.value || item.cost || 0);
        const totalVal = Number(item.value || item.cost || 0);
        allProposalItems.push({
          dealId, proposalId: propId,
          name: getItemName(item), sku: String(item.code || item.reference || "—"),
          qty, unitVal, totalVal, dealStatus: "aberta",
        });
      });
    } else if (Number(prop.value) > 0) {
      allProposalItems.push({
        dealId, proposalId: propId,
        name: "Proposta (resumo)", sku: "—",
        qty: 1, unitVal: Number(prop.value), totalVal: Number(prop.value),
        dealStatus: "aberta",
      });
    }
  });
}
```

Também replicar a mesma lógica no bloco de `flatProposals` (linha 678) e no `productMixRows` para que as tabelas "Propostas Detalhadas" e "Product Mix" também exibam os dados.

## Escopo restrito

- Apenas leitura de `ld.proposals_data` como fonte complementar
- Zero alteração no card do lead, timeline, ingest-lead ou integrações
- Apenas `LeadDetailPanel.tsx` é modificado

