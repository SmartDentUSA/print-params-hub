import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { shortOrigin, buildText } from "./logic.ts";
Deno.test("origens curtas", () => {
  assertEquals(shortOrigin("# - [META] - RayShape Edge Mini"), "Meta · RayShape Edge Mini");
  assertEquals(shortOrigin("piperun_webhook"), "CRM (PipeRun)");
  assertEquals(shortOrigin("# - Impresoras - Smart Dent"), "Impresoras");
});
Deno.test("mensagem traz leads do mês e junta origens iguais", () => {
  const t = buildText({ day: "2026-11-21", leads_total: 7, leads_month_total: 900, won_day_value: 0, won_day_count: 0, won_month_value: 10, won_month_count: 1,
    leads_by_origin: [{ origem: "piperun", total: 6 }, { origem: "piperun_webhook", total: 1 }] });
  assertStringIncludes(t, "Leads no mês:* 900");
  assertStringIncludes(t, "CRM (PipeRun): 7");
});
