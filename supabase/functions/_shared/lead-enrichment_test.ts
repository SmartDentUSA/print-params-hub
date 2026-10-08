import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mergeSmartLead } from "./lead-enrichment.ts";

Deno.test("event submission refreshes latest event snapshot", () => {
  const result = mergeSmartLead(
    {
      event_id: "event-old",
      event_consultant_team_member_id: "seller-old",
      event_interest_categories: ["Scanner"],
    },
    {
      event_id: "event-new",
      event_consultant_team_member_id: "seller-new",
      event_interest_categories: ["Impressão 3D", "Cursos"],
    },
    "form",
  );

  assertEquals(result.merged.event_id, "event-new");
  assertEquals(result.merged.event_consultant_team_member_id, "seller-new");
  assertEquals(result.merged.event_interest_categories, ["Impressão 3D", "Cursos"]);
});