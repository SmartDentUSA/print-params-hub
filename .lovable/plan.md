

## Fix: Falhas Silenciosas no `smart-ops-lia-assign`

### Causa Raiz (3 falhas no codigo)

**Falha 1 — Linha 1410-1411**: Quando `createPerson` falha (retorna `null`), o codigo cai no `else` (linha 1404) e define `flowType = "error_no_person"`. Porem, na linha 1410, o `updateFields` **sempre** define `proprietario_lead_crm: assignedOwnerName` — independente do `flowType`. Resultado: o lead fica com dono atribuido mas sem Person/Deal no PipeRun.

**Falha 2 — Linha 1192**: O guard de idempotencia verifica apenas `lead.proprietario_lead_crm && lead.updated_at`. Nao verifica se `piperun_id` existe. Entao na proxima tentativa, o lead e ignorado porque "ja tem dono", mesmo que nunca tenha criado deal.

**Falha 3 — Nenhum log**: Quando `flowType === "error_no_person"`, nao ha registro em `system_health_logs`. A falha e completamente invisivel.

### Correcoes

**1. `supabase/functions/smart-ops-lia-assign/index.ts` — Linha ~1409-1412**

Condicionar a atribuicao de `proprietario_lead_crm` ao sucesso do sync:

```typescript
const updateFields: Record<string, unknown> = {};

if (flowType !== "error_no_person") {
  updateFields.proprietario_lead_crm = assignedOwnerName;
} else {
  // Log the failure for visibility
  try {
    await supabase.from("system_health_logs").insert({
      function_name: "smart-ops-lia-assign",
      severity: "error",
      error_type: "crm_person_creation_failed",
      lead_email: lead.email,
      details: { lead_id: lead.id, flow: flowType },
    });
  } catch {}
}
```

**2. Linha 1192 — Fortalecer guard de idempotencia**

Adicionar `lead.piperun_id` na condicao:

```typescript
if (!force && trigger !== "sdr_captacao_reativacao" 
    && lead.proprietario_lead_crm && lead.piperun_id && lead.updated_at) {
```

Assim, leads que falharam (tem dono mas sem `piperun_id`) serao reprocessados automaticamente na proxima interacao.

**3. Deploy da edge function**

### Resultado
- Leads que falharem na criacao de Person no PipeRun NAO terao o proprietario bloqueado — permitindo retry automatico
- Falhas ficam visiveis no System Health dashboard
- Lead `dralucianajuliano@gmail.com` sera reprocessado na proxima interacao com a L.I.A. (ou via force=true manual)

