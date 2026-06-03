## Diagnóstico do deal #60413993 (lead Angela Maria)

Timeline observada:
- 20:26:06 — deal #60413993 criado em "Sem contato"
- 20:26:08 — Resumo do Lead **#1** (snapshot stale: primeiro contato 22/11/2025, 1 deal)
- 20:26:10 — Resumo do Lead **#2** (snapshot fresh: primeiro contato 02/06/2026, 2 deals)
- 20:27:00 — `🔁 [Dra. L.I.A.] Re-entrega Meta (form "...").` — sem sufixo "enriqueceu" → `enrichedFields=[]`

Ou seja, os dois fixes anteriores não eliminaram o ruído:

### Problema 1 — Resumo duplicado (corrida em paralelo)
O guard atual em `postRichSellerNote` (linhas 704-728 de `smart-ops-lia-assign/index.ts`) é **read-then-write**: lê `last_seller_note_hash`, se for null prossegue, depois grava. Duas invocações paralelas de `smart-ops-lia-assign` (Meta redelivery em janela de ms) leem `null` ao mesmo tempo, ambas passam, ambas postam. Hash dedup só funciona em segunda passada.

Skipar `smart-ops-deal-form-note` (Fix 1 anterior) não resolve, pois ambos os resumos vieram do próprio `lia-assign`.

### Problema 2 — "Re-entrega Meta" com enrichedFields vazio ainda apareceu
Texto da nota = `Re-entrega Meta (form "...").` (termina em `).` sem "enriqueceu") — corresponde **exclusivamente** ao caminho de CASE A (linha 1976), já protegido por `if (enrichedFields.length > 0)`. A única explicação é que **a função não foi efetivamente redeployada** entre o último patch e este disparo (20:27:00), ou rodou da versão antiga em cache.

---

## Plano

### FIX A — Claim atômico de slot de "Resumo do Lead" (elimina race)

Em `supabase/functions/smart-ops-lia-assign/index.ts`, dentro de `postRichSellerNote` (linhas 704-745), substituir o padrão read-then-write por um **UPDATE condicional** que serve de lock atômico:

```ts
// Claim atômico: só posta se ninguém escreveu o mesmo hash OU houve nota há mais de 5 min.
const nowIso = new Date().toISOString();
const cutoffIso = new Date(Date.now() - 5 * 60 * 1000).toISOString();
const { data: claimed, error: claimErr } = await supabase
  .from("lia_attendances")
  .update({ last_seller_note_hash: hash, last_seller_note_at: nowIso })
  .eq("id", leadId)
  .or(`last_seller_note_at.is.null,last_seller_note_at.lt.${cutoffIso}`)
  .neq("last_seller_note_hash", hash)
  .select("id")
  .maybeSingle();
if (claimErr) {
  console.warn("[lia-assign] seller-note claim update failed:", claimErr);
}
if (!claimed) {
  console.log(`[lia-assign] Seller note slot busy/duplicate — skipping for lead ${leadId} deal ${dealId}`);
  return;
}
// Slot claimed → posta. Se addDealNote falhar, revertemos o claim para permitir retry.
const result = await addDealNote(apiToken, dealId, finalHtml);
if (!result?.success) {
  await supabase
    .from("lia_attendances")
    .update({ last_seller_note_hash: null, last_seller_note_at: null })
    .eq("id", leadId)
    .eq("last_seller_note_hash", hash);
}
```

Remover o bloco anterior de leitura prévia + update pós-post. O claim acontece **antes** do `addDealNote`, garantindo que somente uma das invocações concorrentes consegue postar. PostgreSQL trata `UPDATE … RETURNING` como atômico por linha.

Aplicar o **mesmo padrão** em `supabase/functions/smart-ops-deal-form-note/index.ts` (linhas 90-105) para consistência caso o caminho não-Meta seja chamado em paralelo no futuro.

### FIX B — Garantir que o guard de `enrichedFields.length > 0` esteja ativo

O patch da rodada anterior já está no arquivo (linha 1972). Acionar **redeploy explícito** de `smart-ops-lia-assign` para garantir que a versão correta está em produção. Adicionar também um log no início de CASE A registrando `enrichedFields.length` para auditoria futura:

```ts
console.log(`[lia-assign] CASE A preserve_vendas: deal=${vendaDeal.id} enrichedFields=${enrichedFields.length} (${enrichedFields.join(",") || "—"})`);
```

### FIX C — Reverter Fix 1 anterior (skip de deal-form-note para Meta)

Reverter o guard `source !== "meta_lead_ads"` em `smart-ops-ingest-lead/index.ts` (~linha 1267). Não era a causa do duplicado (ambos os resumos vieram do `lia-assign`), e mantê-lo bloqueia o canal `deal-form-note` para casos legítimos. Com o claim atômico do FIX A, a corrida fica neutralizada em ambos os caminhos.

---

## Arquivos alterados
- `supabase/functions/smart-ops-lia-assign/index.ts` — claim atômico em `postRichSellerNote`; log adicional em CASE A.
- `supabase/functions/smart-ops-deal-form-note/index.ts` — mesmo claim atômico.
- `supabase/functions/smart-ops-ingest-lead/index.ts` — reverter guard `source !== "meta_lead_ads"`.

## Deploy
Redeploy explícito de **as três funções** após patch. Sem migrations.

## Validação
- Próxima submissão Meta: confirmar apenas **uma** nota "Resumo do Lead" no timeline e ausência de "Re-entrega Meta" quando `enriched_fields=[]`.
- Logs: procurar `Seller note slot busy/duplicate` (confirma race detectada e bloqueada) e `CASE A preserve_vendas: … enrichedFields=0` sem nota subsequente.
