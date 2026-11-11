import { test } from "node:test";
import assert from "node:assert/strict";
import { detectWizardIntent, WIZ_SKIP } from "./copilotWizard.ts";
import {
  compatibleFormats, parseTimeBR, socialBulkWizard, socialPostWizard,
  type BulkState, type PostState, type SocialPostDeps,
} from "./copilotSocialPostWizard.ts";
import { liveAutomationWizard, postGroupsWizard, type SocialGroupsDeps, type LivesState, type TargetsState } from "./copilotSocialGroupsWizard.ts";
import { bulkChannels, bulkPlan } from "./social/bulkPlan.ts";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const img = { url: "https://x.supabase.co/storage/v1/object/public/wa-media/a.jpg", type: "image" as const };
const vid = { url: "https://x.supabase.co/storage/v1/object/public/wa-media/b.mp4", type: "video" as const };
const postDeps: SocialPostDeps = {
  searchProducts: async (q) => (/vital/i.test(q) ? [{ ref: "product:1", name: "Resina Vitality", slug: "vitality", category: "Resinas" }] : []),
  generateCaption: async () => ({ caption: "Conheça a Vitality\nTexto", hashtags: ["odonto", "#resina"], first_comment: "Fale conosco" }),
  generateBulkCopies: async (media) => media.map((_, i) => (i === 1 ? { ok: false as const, error: "falhou" } : { ok: true as const, copy: { caption: `Legenda ${i + 1}`, hashtags: [], first_comment: "" } })),
  nowMs: () => NOW,
};

async function run<S>(w: { init: any; answer: any }, deps: any, answers: string[]) {
  let s: S = await w.init(deps, "2026-11-11");
  for (const a of answers) {
    const r = await w.answer(s, a, deps);
    if ("error" in r) throw new Error(`${(s as any).step}: ${r.error}`);
    s = r.state;
  }
  return s;
}

test("pedidos digitados abrem o passo a passo certo do Social Publisher", () => {
  assert.equal(detectWizardIntent("quero criar um post do Vitality"), "post_social");
  assert.equal(detectWizardIntent("agendar posts em massa"), "posts_massa");
  assert.equal(detectWizardIntent("criar automação de lives nos grupos"), "automacao_lives");
  assert.equal(detectWizardIntent("criar automações dos post grupos"), "post_grupos");
  assert.equal(detectWizardIntent("quero um reels sobre a impressora", "social", "novo"), "post_social");
  assert.equal(detectWizardIntent("agendar 10 vídeos", "social", "agendamento-massa"), "posts_massa");
  assert.equal(detectWizardIntent("criar campanha para grupos de WhatsApp"), null);
  assert.equal(detectWizardIntent("editar um post"), null);
});

test("horários digitados", () => {
  assert.equal(parseTimeBR("10"), 600);
  assert.equal(parseTimeBR("10h30"), 630);
  assert.equal(parseTimeBR("18:15"), 1095);
  assert.equal(parseTimeBR("25:00"), null);
});

test("formatos de vídeo e carrossel só aparecem com a mídia certa", () => {
  const onlyImg = compatibleFormats([img]).map((o) => o.key);
  assert.ok(!onlyImg.includes("youtube-video"));
  assert.ok(!onlyImg.includes("instagram-reels"));
  assert.ok(!onlyImg.includes("instagram-carousel"));
  assert.ok(compatibleFormats([img, img]).some((o) => o.key === "instagram-carousel"));
  const text = compatibleFormats([]).map((o) => o.key);
  assert.ok(text.includes("facebook-feed") && !text.includes("instagram-feed"));
});

test("criar post com IA, YouTube com título e agendamento futuro", async () => {
  const s = await run<PostState>(socialPostWizard, postDeps, [
    "vitality", "product:1", "ia", WIZ_SKIP, "use", "__keep", "__keep",
    JSON.stringify([img, vid]), JSON.stringify(["instagram-feed", "youtube-shorts"]), "__first",
    "sched", "12/11/2026", "10:30",
  ]);
  assert.equal(s.step, "review");
  const p = socialPostWizard.payload(s) as any;
  assert.equal(p.product_ref, "product:1");
  assert.deepEqual(p.hashtags, ["odonto", "resina"]);
  assert.equal(p.channels[1].title, "Conheça a Vitality");
  assert.equal(p.scheduled_at, "2026-11-12T13:30:00.000Z");
  assert.equal(p.publish_now, false);
});

test("post sem legenda exige mídia e horário passado é recusado", async () => {
  const s0 = await run<PostState>(socialPostWizard, postDeps, [WIZ_SKIP, "manual", WIZ_SKIP, WIZ_SKIP, WIZ_SKIP]);
  assert.equal(s0.step, "midia");
  const r = await socialPostWizard.answer(s0, WIZ_SKIP, postDeps);
  assert.ok("error" in r);
  const s1 = await run<PostState>(socialPostWizard, postDeps, [WIZ_SKIP, "manual", "Oi", WIZ_SKIP, WIZ_SKIP, WIZ_SKIP, JSON.stringify(["facebook-feed"]), "sched", "11/11/2026"]);
  const late = await socialPostWizard.answer(s1, "08:00", postDeps);
  assert.ok("error" in late);
});

test("agendamento em massa: datas espaçadas, horário 07–21h e mídia com falha fica de fora", async () => {
  const s = await run<BulkState>(socialBulkWizard, postDeps, [
    JSON.stringify([img, vid, img]), JSON.stringify(["instagram", "youtube"]), JSON.stringify(["feed", "reels"]), "hide", "Shorts",
    "amanhã", "2", "18:00", WIZ_SKIP, "@dr.joao", "@smartdent", WIZ_SKIP,
  ]);
  assert.equal(s.step, "review");
  assert.equal(s.posts.length, 2);
  assert.equal(s.failures.length, 1);
  const rows = socialBulkWizard.payload(s).posts as any[];
  assert.equal(rows[0].scheduled_at, "2026-11-12T21:00:00.000Z");
  assert.equal(rows[1].scheduled_at, "2026-11-16T21:00:00.000Z");
  assert.deepEqual(rows[0].channels.map((c: any) => c.format), ["Feed"]);
  assert.deepEqual(rows[0].channels[0].collaborators, ["smartdent"]);
  const early = await run<BulkState>(socialBulkWizard, postDeps, [JSON.stringify([img]), JSON.stringify(["facebook"]), "amanhã", "1"]);
  assert.ok("error" in (await socialBulkWizard.answer(early, "06:00", postDeps)));
  assert.ok("error" in (await socialBulkWizard.answer(early, "10:10", postDeps)));
});

test("imagem só com YouTube não pode seguir", async () => {
  const s = await run<BulkState>(socialBulkWizard, postDeps, [JSON.stringify([img, vid])]);
  const r = await socialBulkWizard.answer(s, JSON.stringify(["youtube"]), postDeps);
  assert.ok(!("error" in r) && r.state.step === "yt_formato");
  if ("error" in r) return;
  assert.ok("error" in (await socialBulkWizard.answer(r.state, "Shorts", postDeps)));
});

test("regras do agendamento em massa iguais à tela", () => {
  const plan = bulkPlan([img, vid], "2026-11-30", 3, 600);
  assert.deepEqual(plan.map((p) => `${p.date} ${p.time}`), ["2026-11-30 10:00", "2026-12-03 10:00"]);
  const o = { channels: ["instagram", "tiktok"] as any, igFeed: false, igReels: true, igStories: false, igHideFromGrid: true, ytFormat: "Shorts" as const, subreddit: "", pinBoard: "", tags: [], collabs: [] };
  assert.equal(bulkChannels(o, false, "x").length, 0);
  assert.deepEqual(bulkChannels(o, true, "x").map((c) => `${c.platform}:${c.format}:${c.ig_share_to_feed ?? ""}`), ["instagram:Reels:false", "tiktok:Vídeo:"]);
});

const groupsDeps: SocialGroupsDeps = {
  loadInstances: async () => [{ name: "cs_principal", enabled: true, targets: 1, available: 3 }, { name: "Danilo-Henrique", enabled: false, targets: 0, available: 2 }],
  targetIds: async () => ["00000000-0000-4000-8000-000000000001"],
  searchInstanceGroups: async (instance) => [
    { id: "00000000-0000-4000-8000-000000000001", name: "Clientes Ribeirão", members: 200, instance },
    { id: "00000000-0000-4000-8000-000000000002", name: "Ribeirão Dentistas", members: 150, instance },
  ],
  loadTargetGroups: async () => [
    { id: "00000000-0000-4000-8000-000000000001", name: "Clientes Ribeirão", members: 200, instance: "cs_principal" },
    { id: "00000000-0000-4000-8000-000000000003", name: "Lives Smart", members: 90, instance: "smartdent_marketing" },
  ],
  loadLiveCourses: async () => [{ id: "00000000-0000-4000-8000-0000000000aa", title: "Live Resinas", category: "Live" }],
};

test("Post Grupos: grupos já configurados não aparecem e instância é ativada", async () => {
  const s0 = await run<TargetsState>(postGroupsWizard, groupsDeps, ["Danilo-Henrique", "on", "ribeirão"]);
  assert.deepEqual(s0.results.map((g) => g.id), ["00000000-0000-4000-8000-000000000002"]);
  const s = await run<TargetsState>(postGroupsWizard, groupsDeps, ["Danilo-Henrique", "on", "ribeirão", JSON.stringify(["00000000-0000-4000-8000-000000000002"]), "next", JSON.stringify(["instagram", "youtube"])]);
  assert.equal(s.step, "review");
  assert.deepEqual(postGroupsWizard.payload(s), { instance_name: "Danilo-Henrique", enabled: true, group_ids: ["00000000-0000-4000-8000-000000000002"], platforms: ["instagram", "youtube"] });
  const nothing = await run<TargetsState>(postGroupsWizard, groupsDeps, ["cs_principal", "on"]);
  assert.ok("error" in (await postGroupsWizard.answer(nothing, WIZ_SKIP, groupsDeps)));
});

test("Automação de lives: grupos filtrados pela instância e ao menos um envio ativo", async () => {
  const s0 = await run<LivesState>(liveAutomationWizard, groupsDeps, ["__default", JSON.stringify(["smartdent_marketing"]), "__all"]);
  assert.deepEqual(s0.results.map((g) => g.name), ["Lives Smart"]);
  const s1 = await run<LivesState>(liveAutomationWizard, groupsDeps, ["__default", "__all", "__all", JSON.stringify(["00000000-0000-4000-8000-000000000003"]), "next", "__all", "off"]);
  assert.ok("error" in (await liveAutomationWizard.answer(s1, "off", groupsDeps)));
  const s = await run<LivesState>(liveAutomationWizard, groupsDeps, ["Lives de novembro", "__all", "__all", JSON.stringify(["00000000-0000-4000-8000-000000000003"]), "next", "__all", "on", "2", "9h", "__default", "on", "10", "__default", "on"]);
  const p = liveAutomationWizard.payload(s) as any;
  assert.equal(p.name, "Lives de novembro");
  assert.equal(p.promo_days_before, 2);
  assert.equal(p.promo_time, "09:00");
  assert.equal(p.live_minutes_before, 10);
  assert.deepEqual(p.group_ids, ["00000000-0000-4000-8000-000000000003"]);
  assert.equal(p.enabled, true);
});
