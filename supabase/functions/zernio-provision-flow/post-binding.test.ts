import { expect, test } from "bun:test";
import { postBinding } from "./post-binding";

test("qualquer comentário somente no reel informado, sem disparar por DM", () => {
  expect(postBinding({ keywords: [], platform_post_id: "DerX2RClAj5" })).toEqual({
    platformPostId: "DerX2RClAj5", postTitle: "", alsoMatchInDms: false,
  });
});
test("impede qualquer comentário sem um post específico", () => {
  expect(() => postBinding({ keywords: [] })).toThrow();
});
test("preserva flows antigos por palavra-chave", () => {
  expect(postBinding({ keywords: ["EXOPLAN"] })).toEqual({});
});