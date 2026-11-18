import { test } from "node:test";
import assert from "node:assert/strict";
import { orderedButtons, waOfficialRow, filterRecipients, type WaRecipient } from "./waOfficialHistory";

test("botões seguem a ordem do template: Botão 1 e Botão 2, mesmo sem cliques", () => {
  const out = orderedButtons(
    [{ type: "QUICK_REPLY", text: "Quero saber mais" }, { type: "QUICK_REPLY", text: "Falar com consultor" }],
    { "Falar com consultor": 1 },
  );
  assert.deepEqual(out, [{ label: "Quero saber mais", count: 0 }, { label: "Falar com consultor", count: 1 }]);
});

test("custo real = entregues (inclui lidos) × valor por mensagem; previsto = valor salvo no envio", () => {
  const r = waOfficialRow({
    leadCount: 2666, summary: { total: 2666, pending: 2416, sent: 1, delivered: 101, read: 103, failed: 45 },
    engagement: null, costPerMessage: 0.35, estimatedCost: 933.1,
  });
  assert.equal(r.real, 71.4); // 204 × 0,35
  assert.equal(r.estimated, 933.1);
  assert.equal(r.delivered, 204);
  assert.equal(r.failed, 45);
  assert.equal(r.inProgress, 2417); // fila + aguardando confirmação
  assert.equal(r.dispatched, 250);
});

test("sem valor por mensagem, custos ficam em branco", () => {
  const r = waOfficialRow({ leadCount: 10, summary: { total: 10, delivered: 5 }, engagement: null, costPerMessage: null, estimatedCost: null });
  assert.equal(r.real, null);
  assert.equal(r.estimated, null);
});

test("'não clicou em nada' = entregue, sem clique em botão e sem SAIR", () => {
  const base = { lead_id: "x", nome: null, telefone: null, status: "sent", sent_at: null, read_at: null, error_message: null, first_click_at: null } as const;
  const rows: WaRecipient[] = [
    { ...base, lead_id: "a", provider_status: "delivered", delivered_at: "t", buttons: null, sair_at: null },
    { ...base, lead_id: "b", provider_status: "read", delivered_at: "t", buttons: ["Quero saber mais"], sair_at: null },
    { ...base, lead_id: "c", provider_status: "read", delivered_at: "t", buttons: null, sair_at: "t" },
    { ...base, lead_id: "d", provider_status: "sent", delivered_at: null, buttons: null, sair_at: null },
  ];
  assert.deepEqual(filterRecipients(rows, "no_action").map((r) => r.lead_id), ["a"]);
  assert.deepEqual(filterRecipients(rows, "button", "Quero saber mais").map((r) => r.lead_id), ["b"]);
  assert.deepEqual(filterRecipients(rows, "in_progress").map((r) => r.lead_id), ["d"]);
});
