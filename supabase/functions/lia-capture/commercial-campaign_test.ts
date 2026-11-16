import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { campaignButtons, campaignDisplayName, campaignMessageName, presetInterest, GROUP_REDIRECT_MS, isCommercialCampaignName, matchInterest } from "./commercial-campaign.ts";

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

Deno.test("renomear o formulário não desfaz a campanha comercial", async () => {
  const { isCommercialCampaignForm } = await import("./commercial-campaign.ts");
  assertEquals(isCommercialCampaignForm({ is_commercial_campaign: true, name: "# - [BLACK26] - Engajamento" }), true);
  assertEquals(isCommercialCampaignForm({ is_commercial_campaign: false, name: "# - FORMS - exocad" }), false);
  assertEquals(campaignDisplayName("# - [BLACK26] - Engajamento"), "BLACK26 - Engajamento");
});

Deno.test("campaignMessageName tira o período de dias das tabelas BlackFriday", () => {
  assertEquals(campaignMessageName("BlackFriday 16 a 20"), "BlackFriday");
  assertEquals(campaignMessageName("BlackFriday 21 a 25"), "BlackFriday");
  assertEquals(campaignMessageName("BlackFriday 26 a 30 "), "BlackFriday");
  assertEquals(campaignMessageName("Política OUT/NOV 26"), "Política OUT/NOV 26");
  assertEquals(campaignMessageName("Black 26"), "Black 26");
});

Deno.test("item da landing já escolhido: botão pelo produto ou produto ativo do catálogo", () => {
  const buttons = [
    { label: "Elegoo Mars 5 Ultra", product_catalog_id: "e3e1e4cd-10c7-48b0-aee4-4cf4fd4d96f7", product_name: "Impressora 3D Elegoo Mars 5 Ultra" },
    { label: "Resina direta", product_catalog_id: null, product_name: null },
  ];
  // Produto que também é botão usa o botão (rótulo e produto do formulário).
  assertEquals(presetInterest(buttons, { product_catalog_id: "e3e1e4cd-10c7-48b0-aee4-4cf4fd4d96f7" }, null)?.label, "Elegoo Mars 5 Ultra");
  // Produto do catálogo que não é botão vira o interesse com o nome exato do catálogo.
  const cat = { id: "10f52620-8138-4ce9-a5c7-1cb79e59d917", name: "Resina 3D Smart Print Bio Bite Splint +Flex" };
  assertEquals(presetInterest(buttons, { product_catalog_id: cat.id }, cat), { label: cat.name, product_catalog_id: cat.id, product_name: cat.name });
  // ID sem produto ativo no catálogo não preenche nada.
  assertEquals(presetInterest(buttons, { product_catalog_id: cat.id }, null), null);
  // Itens sem produto único usam o botão do formulário pelo rótulo.
  assertEquals(presetInterest(buttons, { interest: "resina direta" })?.label, "Resina direta");
  assertEquals(presetInterest(buttons, { interest: "Qualquer coisa" }), null);
});
