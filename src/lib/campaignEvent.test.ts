import { test } from "node:test";
import assert from "node:assert/strict";
import { campaignEventId } from "./campaignEvent";

test("campanhas de todos os canais podem ficar sem evento", () => {
  for (const value of [undefined, null, "", "   "]) assert.equal(campaignEventId(value), null);
});

test("o vínculo conserva o identificador do evento escolhido", () => {
  assert.equal(campaignEventId("6914e294-2313-4694-93b5-b7736747feae"), "6914e294-2313-4694-93b5-b7736747feae");
});