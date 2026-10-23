import { test } from "node:test";
import assert from "node:assert/strict";
import { recordBioEvent, type BioEvent, type BioEventPayload } from "./bioTracking.ts";

test("executes lazy inserts for visits and each Bio click type", async () => {
  const sent: BioEventPayload[] = [];
  const insert = (payload: BioEventPayload) => ({
    then(resolve: (value: { error: null }) => unknown) {
      sent.push(payload);
      return Promise.resolve(resolve({ error: null }));
    },
  }) as PromiseLike<{ error: null }>;
  for (const event of ["view", "card_click", "cta_click", "whatsapp_click"] as BioEvent[]) {
    await recordBioEvent(insert, "bio-page", event, event === "view" ? undefined : "form:tmk");
  }
  assert.deepEqual(sent, [
    { page_id: "bio-page", event_type: "view", item_id: null },
    { page_id: "bio-page", event_type: "card_click", item_id: "form:tmk" },
    { page_id: "bio-page", event_type: "cta_click", item_id: "form:tmk" },
    { page_id: "bio-page", event_type: "whatsapp_click", item_id: "form:tmk" },
  ]);
});

test("does not insert an event without a resolved Bio page", async () => {
  let calls = 0;
  await recordBioEvent(() => { calls++; return Promise.resolve({ error: null }); }, undefined, "view");
  assert.equal(calls, 0);
});