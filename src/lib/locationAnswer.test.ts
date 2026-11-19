import { test } from "node:test";
import assert from "node:assert/strict";
import { formatLocation, locationColumns } from "./locationAnswer";

test("vira 'Cidade, Estado, País'", () => {
    assert.equal(formatLocation({ pais: "Brazil", estado: "São Paulo", cidade: "Ribeirão Preto" }), "Ribeirão Preto, São Paulo, Brazil");
  });
test("no Brasil grava a sigla do estado como UF", () => {
    assert.deepEqual(locationColumns({ pais: "Brazil", estado: "São Paulo", estadoSigla: "SP", cidade: "Ribeirão Preto" }), { cidade: "Ribeirão Preto", pais_origem: "Brazil", uf: "SP" });
  });
