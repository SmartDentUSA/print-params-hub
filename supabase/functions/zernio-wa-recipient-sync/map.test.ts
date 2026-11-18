import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dueBroadcasts, toRecipientRows } from "./map.ts";

Deno.test("lido, entregue e recusado viram linhas; pendente fica de fora", () => {
  const rows = toRecipientRows([
    { platformIdentifier: "+55 19 99261-2348", status: "read", sentAt: "a", deliveredAt: "b", readAt: "c", messageId: "wamid.1" },
    { platformIdentifier: "5511999990000", status: "failed", errorCode: 131026, error: "Message undeliverable" },
    { platformIdentifier: "5511888880000", status: "pending" },
  ]);
  assertEquals(rows.length, 2);
  assertEquals(rows[0].phone, "5519992612348");
  assertEquals(rows[0].read_at, "c");
  assertEquals(rows[1].error, "131026 Message undeliverable");
});

Deno.test("só lotes que já saíram e com menos de 7 dias", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const slots = [
    { at: "2026-11-10T13:51:00Z", broadcast_ids: ["velho"] },
    { at: "2026-11-18T13:51:00Z", broadcast_ids: ["a", "b"] },
    { at: "2026-11-21T13:51:00Z", broadcast_ids: ["futuro"] },
  ];
  assertEquals(dueBroadcasts(slots, ["velho", "a", "b", "futuro"], now), ["a", "b"]);
  assertEquals(dueBroadcasts([], ["x"], now), ["x"]);
});
