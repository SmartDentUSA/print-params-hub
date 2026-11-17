// Imagem do cronômetro de campanha usada nos e-mails (verify_jwt = false: o leitor de e-mail
// busca a imagem sem login). Só desenha a partir dos parâmetros; não lê nem grava o banco.
import { countdownState, parseCountdownParams } from "../_shared/email-countdown.ts";
import { renderCountdownGif } from "./render.ts";

const NO_CACHE = {
  "Cache-Control": "no-cache, no-store, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

// Várias aberturas no mesmo segundo reaproveitam a mesma imagem.
const cache = new Map<string, Uint8Array>();

Deno.serve(async (req) => {
  if (req.method !== "GET" && req.method !== "HEAD") return new Response("method not allowed", { status: 405 });
  const url = new URL(req.url);
  const parsed = parseCountdownParams(url.searchParams);
  if (!parsed) return new Response("parâmetros inválidos", { status: 400 });
  const now = Math.floor(Date.now() / 1000) * 1000;
  const key = `${url.search}|${now}`;
  let gif = cache.get(key);
  if (!gif) {
    const state = countdownState(now, parsed.cfg, parsed.kind, parsed.fixedPct);
    gif = await renderCountdownGif(state, now);
    if (cache.size > 30) cache.clear();
    cache.set(key, gif);
  }
  return new Response(req.method === "HEAD" ? null : gif, {
    headers: { "Content-Type": "image/gif", "Content-Length": String(gif.length), ...NO_CACHE },
  });
});
