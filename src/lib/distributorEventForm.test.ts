import { test } from "node:test";
import assert from "node:assert/strict";
import { distributorEventAnswers } from "./distributorEventForm";

const fields = [
  { id: "country", label: "País", db_column: "empresa_pais", custom_field_name: null },
  { id: "state", label: "Estado", db_column: "empresa_uf", custom_field_name: null },
  { id: "city", label: "Cidade", db_column: "empresa_cidade", custom_field_name: null },
  { id: "interest", label: "Interesse", db_column: null, custom_field_name: "distribuidor_linhas" },
  { id: "language", label: "Idioma", db_column: null, custom_field_name: "distribuidor_idioma" },
];
test("event distributor forms retain country, province and city answers under original field IDs", () => {
  assert.deepEqual(distributorEventAnswers({ pais: "Brazil", estado: "São Paulo", cidade: "São Carlos" }, fields).answers,
    { country: "Brazil", state: "São Paulo", city: "São Carlos", interest: "", language: "pt" });
});
test("translated event distributor forms submit canonical interest categories and language", () => {
  const result = distributorEventAnswers({ language_preference: "es", authorized_scope: { "Impressão 3D": ["Resinas"] } }, fields);
  assert.equal(result.answers.interest, "Impressão 3D: Resinas");
  assert.equal(result.answers.language, "es");
});