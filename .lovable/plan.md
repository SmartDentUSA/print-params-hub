

## Problema

O handoff da LIA atualiza os dados do lead no banco local (`lia_attendances`) mas **nunca sincroniza com o SellFlux V1 (webhook de Leads)**. A função `sendLeadToSellFlux` existe no shared mas não é chamada em `notifySellerHandoff`.

Resultado: o SellFlux não recebe as atualizações de tags, status, etapa comercial, etc.

## Correção

### Arquivo: `supabase/functions/dra-lia/index.ts`

Após a atualização do `lia_attendances` (linha ~1557), adicionar chamada ao webhook V1 do SellFlux para sincronizar os dados do lead:

```typescript
// 5b. Sync lead data to SellFlux V1 (Leads webhook)
const SELLFLUX_WEBHOOK_LEADS = Deno.env.get("SELLFLUX_WEBHOOK_LEADS");
if (SELLFLUX_WEBHOOK_LEADS) {
  try {
    const sellfluxLeadData = {
      email: leadEmail,
      nome: leadName,
      telefone_normalized: attendance.telefone_normalized,
      area_atuacao: attendance.area_atuacao,
      especialidade: attendance.especialidade,
      produto_interesse: attendance.produto_interesse,
      impressora_modelo: attendance.impressora_modelo,
      tem_scanner: attendance.tem_scanner,
      lead_status: "em_atendimento",
      proprietario_lead_crm: attendance.proprietario_lead_crm,
      ultima_etapa_comercial: "contato_feito",
      tags_crm: newTags,
      score: attendance.score,
      temperatura_lead: "quente",
      origem_campanha: origemCampanha,
      piperun_id: attendance.piperun_id,
    };
    const sfResult = await sendLeadToSellFlux(SELLFLUX_WEBHOOK_LEADS, sellfluxLeadData);
    console.log(`[handoff] SellFlux V1 lead sync: ${sfResult.success ? "✅" : "❌"} status=${sfResult.status}`);
  } catch (e) {
    console.warn(`[handoff] SellFlux V1 sync error:`, e);
  }
}
```

Também precisa importar `sendLeadToSellFlux` no topo do arquivo (já importa de `sellflux-field-map.ts`).

Precisa ampliar o `select` do attendance (linha 1437) para incluir os campos extras que o SellFlux precisa: `area_atuacao, impressora_modelo, tem_scanner`.

### Deploy
- `dra-lia`

