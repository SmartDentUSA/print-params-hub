import { describe, expect, it } from "vitest";
import { formatLocation, locationColumns } from "./locationAnswer";

describe("resposta de localização", () => {
  it("vira 'Cidade, Estado, País'", () => {
    expect(formatLocation({ pais: "Brazil", estado: "São Paulo", cidade: "Ribeirão Preto" })).toBe("Ribeirão Preto, São Paulo, Brazil");
  });
  it("no Brasil grava a sigla do estado como UF", () => {
    expect(locationColumns({ pais: "Brazil", estado: "São Paulo", estadoSigla: "SP", cidade: "Ribeirão Preto" }))
      .toEqual({ cidade: "Ribeirão Preto", pais_origem: "Brazil", uf: "SP" });
  });
});
