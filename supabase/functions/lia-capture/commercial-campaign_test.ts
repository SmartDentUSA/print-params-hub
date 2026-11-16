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

import { chosenItemLabel, sellerWhatsAppText, simulatorItemLabel } from "./commercial-campaign.ts";

const sims = [
  { id: "geral", label: "Atendimento geral" },
  { id: "smartmake-avulsos", label: "SmartMake · itens avulsos (17 itens)", button: "Caracterização" },
  { id: "combo-vitality-nanoclean", label: "Combo 3 Vitality com 15% OFF + NanoClean PoD de brinde", button: "Resinas" },
];

Deno.test("landing card label names the item; the general simulator has none", () => {
  assertEquals(simulatorItemLabel(sims, "smartmake-avulsos"), "SmartMake · itens avulsos (17 itens)");
  assertEquals(simulatorItemLabel(sims, "geral"), null);
  assertEquals(simulatorItemLabel(sims, "nao-existe"), null);
  assertEquals(simulatorItemLabel(sims, "combo-vitality-nanoclean"), "Combo 3 Vitality + NanoClean PoD de brinde");
});

Deno.test("after conversion the phrase names the card, the exact product or the chosen category", () => {
  const caracterizacao = buttons.find((b) => b.label === "Caracterização")!;
  const scanner = buttons.find((b) => b.label === "Scanner intraoral")!;
  // Card ligado a um botão de categoria: frase usa o card.
  assertEquals(chosenItemLabel(caracterizacao, caracterizacao, "SmartMake · itens avulsos (17 itens)"), "SmartMake · itens avulsos (17 itens)");
  // Simulador geral, botão de categoria: frase usa a categoria.
  assertEquals(chosenItemLabel(buttons[0], null, null), "Resinas");
  // Botão com produto do catálogo: frase usa o nome exato do produto.
  assertEquals(chosenItemLabel(scanner, null, null), "Scanner X");
  // Lead trocou para outro botão: o card não vale mais.
  assertEquals(chosenItemLabel(buttons[0], caracterizacao, "SmartMake · itens avulsos (17 itens)"), "Resinas");
  assertEquals(chosenItemLabel(null, caracterizacao, "SmartMake"), null);
});

Deno.test("seller WhatsApp text has no article and names the campaign without the period", () => {
  assertEquals(sellerWhatsAppText({ sellerFirst: "Daniele", item: "Caracterização", campaign: "BlackFriday 16 a 20", ticket: "123" }),
    "Olá Daniele, vi a campanha BlackFriday e quero saber mais sobre Caracterização. Meu atendimento já foi registrado com o número 123");
  assertEquals(sellerWhatsAppText({ sellerFirst: "Ana", item: "Impressora 3D Elegoo Mars 5 Ultra", ticket: "9" }),
    "Olá Ana, quero saber mais sobre Impressora 3D Elegoo Mars 5 Ultra. Meu atendimento já foi registrado com o número 9");
});
