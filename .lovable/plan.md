

# Fix: Formulário SDR-Captação bloqueado pelo guard de idempotência

## Diagnóstico

Os logs confirmam a sequência:

1. `ingest-lead` encontrou o lead existente (`danilohen@gmail.com`, piperun_id `25658331`) e fez merge
2. `lia-assign` foi chamado com `trigger: "sdr_captacao_reativacao"`
3. O **guard de idempotência** (linha 995-1003) bloqueou a execução porque `proprietario_lead_crm` já existe E `updated_at` foi há menos de 5 minutos (atualizado pelo merge do ingest-lead segundos antes)
4. A lógica de reativação (linha 1006+) **nunca executou** — o return acontece antes

O lead JÁ está no PipeRun (deal #25658331), mas a nota com os novos dados do formulário não foi adicionada ao deal existente.

## Correção

**Arquivo**: `supabase/functions/smart-ops-lia-assign/index.ts`

Mover o check de `sdr_captacao_reativacao` para **antes** do guard de idempotência, ou excluir o trigger `sdr_captacao_reativacao` do guard:

```typescript
// Linha 995-1003: Alterar para permitir reativação SDR
if (!force && trigger !== "sdr_captacao_reativacao" && lead.proprietario_lead_crm && lead.updated_at) {
  const lastUpdate = new Date(lead.updated_at).getTime();
  if (Date.now() - lastUpdate < 5 * 60 * 1000) {
    console.log("[lia-assign] Already assigned recently, skipping");
    return new Response(JSON.stringify({ skipped: true, reason: "recently_assigned" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
```

Também corrigir os **build errors** em `lia-escalation.ts` e `lia-guards.ts` adicionando type assertions para resolver os erros `'never'` causados por tabelas ausentes no `types.ts` gerado.

## Escopo

- `smart-ops-lia-assign/index.ts`: 1 condição adicionada no guard (linha 996)
- `_shared/lia-escalation.ts`: type assertions para corrigir build errors
- `_shared/lia-guards.ts`: type assertions para corrigir build errors
- Zero alteração no frontend, ingest-lead, ou card do lead

## Resultado esperado

Quando um lead existente preencher um formulário SDR-Captação, o `lia-assign` vai:
1. Passar pelo guard de idempotência (agora permite `sdr_captacao_reativacao`)
2. Executar a lógica de reativação que adiciona nota ao deal existente no PipeRun
3. Atualizar o status do lead conforme necessário

