import { test } from "node:test";
import assert from "node:assert/strict";
import { PostgrestClient } from "@supabase/postgrest-js";
import { applyWaSairFilter } from "./waSairFilter";

const base = () => new PostgrestClient("http://x/rest/v1").from("lia_attendances")
  .select("id", { count: "exact", head: true }).is("merged_into", null);

test("excluir quem respondeu SAIR usa junção sem correspondência", () => {
  const q: any = applyWaSairFilter(base(), "exclude");
  assert.equal(q.url.searchParams.get("select"), "id,wa_official_sair_leads!left(lead_id)");
  assert.equal(q.url.searchParams.get("wa_official_sair_leads"), "is.null");
  assert.equal(q.url.searchParams.get("merged_into"), "is.null");
});

test("somente quem respondeu SAIR usa junção interna, sem filtro de ausência", () => {
  const q: any = applyWaSairFilter(base(), "only");
  assert.equal(q.url.searchParams.get("select"), "id,wa_official_sair_leads!inner(lead_id)");
  assert.equal(q.url.searchParams.get("wa_official_sair_leads"), null);
});
