import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { pickCommercialTables, tableWindow } from "./price-table.ts";

const row = (id: string, from: string | null, until: string | null, extra: Record<string, unknown> = {}) => ({
  id, name: id, status: "active", commercial_active: true, valid_from: from, valid_until: until, updated_at: "2026-11-01T00:00:00Z", ...extra,
});
const sp = (iso: string) => Date.parse(`${iso}-03:00`);

Deno.test("tabela vale até 23:59:59 do último dia em São Paulo", () => {
  const w = tableWindow(row("A", "2026-11-20", "2026-11-27"))!;
  assertEquals(new Date(w.startsAt).toISOString(), "2026-11-20T03:00:00.000Z");
  assertEquals(new Date(w.endsAt).toISOString(), "2026-11-28T03:00:00.000Z");
});

Deno.test("à meia-noite troca da tabela A para a tabela B", () => {
  const rows = [row("A", "2026-11-20", "2026-11-27"), row("B", "2026-11-28", "2026-11-30")];
  assertEquals(pickCommercialTables(rows, sp("2026-11-27T23:59:59")).current?.row.id, "A");
  assertEquals(pickCommercialTables(rows, sp("2026-11-27T23:59:59")).next?.row.id, "B");
  assertEquals(pickCommercialTables(rows, sp("2026-11-28T00:00:00")).current?.row.id, "B");
});

Deno.test("sem 'Ativa para comercial', rascunho ou sem datas não fica vigente", () => {
  const now = sp("2026-11-21T10:00:00");
  const rows = [
    row("off", "2026-11-20", "2026-11-27", { commercial_active: false }),
    row("draft", "2026-11-20", "2026-11-27", { status: "draft" }),
    row("nodate", null, "2026-11-27"),
  ];
  assertEquals(pickCommercialTables(rows, now).current, null);
});

Deno.test("sobreposição: vence a tabela que começou por último", () => {
  const rows = [row("mes", "2026-11-01", "2026-11-30"), row("bf", "2026-11-27", "2026-11-29")];
  assertEquals(pickCommercialTables(rows, sp("2026-11-28T12:00:00")).current?.row.id, "bf");
  assertEquals(pickCommercialTables(rows, sp("2026-11-30T12:00:00")).current?.row.id, "mes");
});

Deno.test("depois do fim, nenhuma tabela vigente", () => {
  assertEquals(pickCommercialTables([row("A", "2026-11-20", "2026-11-27")], sp("2026-11-28T00:00:01")).current, null);
});
