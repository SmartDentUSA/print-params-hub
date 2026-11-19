import { describe, expect, it } from "vitest";
import {
  KOL_EXPANSION_OWNER_PIPERUN_ID, KOL_EXPANSION_PIPELINE_ID, KOL_PARTICIPATION,
  kolExpansionInterest, kolExpansionOrigin, kolExpansionStageId, kolExpansionThanks, kolExpansionWhatsappUrl,
} from "./kolExpansion";

describe("formulário KOL Expansão", () => {
  it("cai no funil 109840 com a Beatriz (104356) como dona", () => {
    expect(KOL_EXPANSION_PIPELINE_ID).toBe(109840);
    expect(KOL_EXPANSION_OWNER_PIPERUN_ID).toBe(104356);
  });
  it("origem é [KOLEXPANSÃO] - nome do evento", () => {
    expect(kolExpansionOrigin("IDS 2027")).toBe("[KOLEXPANSÃO] - IDS 2027");
  });
  it("demonstração vira 'Ver uma demonstração'", () => {
    expect(kolExpansionInterest(KOL_PARTICIPATION.demo)).toBe("Ver uma demonstração");
  });
  it("implantação vira 'Implementar fluxo digital'", () => {
    expect(kolExpansionInterest(KOL_PARTICIPATION.implant)).toBe("Implementar fluxo digital");
  });
  it("treinamento vira 'Participar de um treinamento'", () => {
    expect(kolExpansionInterest(KOL_PARTICIPATION.training)).toBe("Participar de um treinamento");
  });
  it("parceria vira 'Fazer parceria'", () => {
    expect(kolExpansionInterest(KOL_PARTICIPATION.partnership)).toBe("Fazer parceria");
  });
  it("escolhe a etapa Interesse do funil", () => {
    expect(kolExpansionStageId([
      { id: 1, name: "Contato", order: 0, pipeline_id: 109840 },
      { id: 2, name: "Interesse", order: 1, pipeline_id: 109840 },
    ])).toBe(2);
  });
  it("agradece pelo primeiro nome e leva ao WhatsApp do Danilo", () => {
    expect(kolExpansionThanks("Maria Souza")).toBe("Obrigado, Maria! Recebemos seu interesse no Chairside Print. Se quiser adiantar a conversa, fale diretamente com o Danilo no WhatsApp.");
    expect(kolExpansionWhatsappUrl("Maria")).toMatch(/^https:\/\/wa\.me\/5519992612348\?text=/);
  });
});
