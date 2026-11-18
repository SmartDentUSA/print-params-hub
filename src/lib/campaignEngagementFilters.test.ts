import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyEngagementFilters } from "./campaignEngagementFilters";

function fakeQuery() {
  const calls: Array<[string, ...any[]]> = [];
  const url = new URL("http://x/rest/v1/lia_attendances?select=id");
  const q: any = new Proxy({}, {
    get: (_t, prop: string) => prop === "url" ? url : (...args: any[]) => { calls.push([prop, ...args]); return q; },
  });
  return { q, calls, select: () => url.searchParams.get("select") };
}

describe("público pelo histórico de campanhas", () => {
  test("sem filtro não mexe na busca", () => {
    const { q, calls, select } = fakeQuery();
    applyEngagementFilters(q, {});
    assert.deepEqual(calls, []);
    assert.equal(select(), "id");
  });

  test("abriu o e-mail de uma campanha específica", () => {
    const { q, calls, select } = fakeQuery();
    applyEngagementFilters(q, { eng_campanha: "c1", eng_acao: "abriu" });
    assert.equal(select(), "id,eng:campaign_send_log!inner(lead_id)");
    assert.deepEqual(calls, [["eq", "eng.source_campaign_id", "c1"], ["not", "eng.opened_at", "is", null]]);
  });

  test("não recebeu nenhum WhatsApp Oficial: junção sem correspondência", () => {
    const { q, calls, select } = fakeQuery();
    applyEngagementFilters(q, { eng_campanha: "any_wa", eng_acao: "nao_recebeu" });
    assert.equal(select(), "id,eng:campaign_send_log!left(lead_id)");
    assert.deepEqual(calls, [
      ["eq", "eng.provider", "zernio_cloud_api"], ["not", "eng.sent_at", "is", null], ["is", "eng", null],
    ]);
  });

  test("recebeu algum e-mail e não clicou", () => {
    const { q, calls } = fakeQuery();
    applyEngagementFilters(q, { eng_campanha: "any_email", eng_acao: "recebeu_nao_clicou" });
    assert.deepEqual(calls, [
      ["not", "eng.email", "is", null], ["not", "eng.sent_at", "is", null], ["is", "eng.clicked_at", null],
    ]);
  });

  test("converteu no formulário em qualquer momento (histórico completo)", () => {
    const { q, calls, select } = fakeQuery();
    applyEngagementFilters(q, { conv_form: "# - [BLACK26] - Campanha ativa" });
    assert.equal(select(), "id,conv:lead_activity_log!inner(lead_id)");
    assert.deepEqual(calls, [
      ["eq", "conv.event_type", "form_submission"], ["eq", "conv.event_data->>form_name", "# - [BLACK26] - Campanha ativa"],
    ]);
  });

  test("cópia do servidor é igual à do navegador", () => {
    const shared = readFileSync("supabase/functions/_shared/campaign-engagement-filters.ts", "utf8").split("\n").slice(1);
    const web = readFileSync("src/lib/campaignEngagementFilters.ts", "utf8").split("\n").slice(3);
    assert.deepEqual(shared, web);
  });
});
