import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSimulators, pickSimulator, prepareLandingDocument } from "./customLanding";

const sims = parseSimulators([
  { id: "geral", label: "Atendimento geral" },
  { id: "bite-splint-flex", label: "Bite Splint +Flex", product_catalog_id: "10f52620-8138-4ce9-a5c7-1cb79e59d917" },
  { id: "atos-resinas", label: "Resinas Atos", button: "Resina direta" },
  { id: "", label: "sem id" },
]);

test("cada item da landing abre o simulador com o seu produto", () => {
  assert.equal(sims.length, 3);
  assert.equal(pickSimulator(sims, "bite-splint-flex").product_catalog_id, "10f52620-8138-4ce9-a5c7-1cb79e59d917");
  assert.equal(pickSimulator(sims, "atos-resinas").button, "Resina direta");
});

test("botões gerais e itens desconhecidos abrem o simulador geral, sem produto", () => {
  const g = pickSimulator(sims, "geral");
  assert.equal(g.id, "geral");
  assert.equal(g.product_catalog_id, null);
  assert.equal(pickSimulator(sims, "nao-existe").id, "geral");
});

test("a página recebe as UTMs da página principal", () => {
  const doc = prepareLandingDocument("<html><head><title>x</title></head></html>", { search: "?utm_source=meta</script>" });
  assert.match(doc, /<head><script>window.__SD_LP__=\{"search":"\?utm_source=meta\\u003c\/script>","skew":0\};<\/script><title>/);
});
