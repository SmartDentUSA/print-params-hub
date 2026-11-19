import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KOL_EXPANSION_OWNER_PIPERUN_ID, KOL_EXPANSION_PIPELINE_ID, KOL_PARTICIPATION,
  kolExpansionInterest, kolExpansionOrigin, kolExpansionStageId, kolExpansionThanks, kolExpansionWhatsappUrl,
} from "./kolExpansion";

test("cai no funil 109840 com a Beatriz (104356) como dona", () => {
    assert.equal(KOL_EXPANSION_PIPELINE_ID, 109840);
    assert.equal(KOL_EXPANSION_OWNER_PIPERUN_ID, 104356);
  });
test("origem é [KOLEXPANSÃO] - nome do evento", () => {
    assert.equal(kolExpansionOrigin("IDS 2027"), "[KOLEXPANSÃO] - IDS 2027");
  });
test("demonstração vira 'Ver uma demonstração'", () => {
    assert.equal(kolExpansionInterest(KOL_PARTICIPATION.demo), "Ver uma demonstração");
  });
test("implantação vira 'Implementar fluxo digital'", () => {
    assert.equal(kolExpansionInterest(KOL_PARTICIPATION.implant), "Implementar fluxo digital");
  });
test("treinamento vira 'Participar de um treinamento'", () => {
    assert.equal(kolExpansionInterest(KOL_PARTICIPATION.training), "Participar de um treinamento");
  });
test("parceria vira 'Fazer parceria'", () => {
    assert.equal(kolExpansionInterest(KOL_PARTICIPATION.partnership), "Fazer parceria");
  });
test("escolhe a etapa Interesse do funil", () => {
    assert.equal(kolExpansionStageId([
      { id: 1, name: "Contato", order: 0, pipeline_id: 109840 },
      { id: 2, name: "Interesse", order: 1, pipeline_id: 109840 },
    ]), 2);
  });
test("agradece pelo primeiro nome e leva ao WhatsApp do Danilo", () => {
    assert.equal(kolExpansionThanks("Maria Souza"), "Obrigado, Maria! Recebemos seu interesse no Chairside Print. Se quiser adiantar a conversa, fale diretamente com o Danilo no WhatsApp.");
    assert.match(kolExpansionWhatsappUrl("Maria"), /^https:\/\/wa\.me\/5519992612348\?text=/);
  });
