import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { campaignButtons, campaignDisplayName, GROUP_REDIRECT_MS, isCommercialCampaignName, matchInterest } from "./commercial-campaign.ts";

const buttons = campaignButtons(true, [
  { label: "Resinas" }, { label: "Scanner intraoral", product_catalog_id: "abc", product_name: "Scanner X" },
  { label: "Impressora 3D" }, { label: "Caracterização" }, { label: "Cimentos e adesivos" }, { label: "Resina direta" },
]);

Deno.test("only '# - CAMPANHA COMERCIAL -' forms are commercial campaigns", () => {
  assertEquals(isCommercialCampaignName("# - CAMPANHA COMERCIAL - Black 26"), true);
  assertEquals(isCommercialCampaignName("# - GRUPO WHATSAPP - Black 26"), false);
});

Deno.test("the chosen button must be one of the form buttons", () => {
  assertEquals(matchInterest(buttons, "caracterizacao")?.label, "Caracterização");
  assertEquals(matchInterest(buttons, "Scanner intraoral")?.product_name, "Scanner X");
  assertEquals(matchInterest(buttons, "Software CAD"), null);
});

Deno.test("buttons are ignored when disabled", () => {
  assertEquals(campaignButtons(false, [{ label: "Resinas" }]).length, 0);
});

Deno.test("public name strips the prefix and the group opens after 4 seconds", () => {
  assertEquals(campaignDisplayName("# - CAMPANHA COMERCIAL - Black 26"), "Black 26");
  assertEquals(GROUP_REDIRECT_MS, 4000);
});
