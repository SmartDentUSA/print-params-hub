import { test } from "node:test";
import assert from "node:assert/strict";
import { waOfficialCounts, dropMirroredCampaigns, waGroupStatus } from "./campaignHistory";

test("WhatsApp Oficial: enviados somam enviados, entregues e lidos; lidos e falhas separados", () => {
  const c = waOfficialCounts({ total: 2666, pending: 2416, sent: 14, delivered: 173, read: 18, failed: 45 } as any);
  assert.deepEqual(c, { sent: 205, delivered: 191, read: 18, failed: 45, queued: 2416 });
});

test("campanha espelhada da sessão do WhatsApp Oficial não aparece duas vezes", () => {
  const out = dropMirroredCampaigns(
    [{ id: "d828", channel: "whatsapp_oficial" }, { id: "black001", channel: "email" }],
    [{ results: { campaign_id: "d828" } }, { results: {} }],
  );
  assert.deepEqual(out.map((c) => c.id), ["black001"]);
});

test("grupos: mensagens ainda na fila sem nenhum envio aparecem como na fila, não concluída", () => {
  assert.equal(waGroupStatus("active", { groups: 6, total: 138, sent: 0, pending: 134, failed: 4, skipped: 0 }), "queued");
});

test("grupos: campanha com erro e nada enviado é falha total", () => {
  assert.equal(waGroupStatus("error", { groups: 17, total: 17, sent: 0, pending: 0, failed: 17, skipped: 0 }), "failed");
});

test("grupos: terminou com parte enviada e parte com falha", () => {
  assert.equal(waGroupStatus("finished", { groups: 5, total: 10, sent: 8, pending: 0, failed: 2, skipped: 0 }), "completed_with_errors");
});

test("grupos: campanha em erro com parte enviada não aparece como em execução", () => {
  assert.equal(waGroupStatus("error", { groups: 54, total: 54, sent: 12, pending: 34, failed: 8, skipped: 0 }), "completed_with_errors");
});

test("SMS gravado em campanha e sessão com o mesmo nome (segundos de diferença) aparece uma vez", () => {
  const out = dropMirroredCampaigns(
    [{ id: "a618", name: "MEDIT", channel: "sms", created_at: "2026-10-09T20:34:38Z" },
     { id: "outra", name: "MEDIT", channel: "sms", created_at: "2026-10-12T10:00:00Z" }],
    [{ name: "MEDIT", channel: "sms", created_at: "2026-10-09T20:34:40Z", results: {} }],
  );
  assert.deepEqual(out.map((c) => c.id), ["outra"]);
});
