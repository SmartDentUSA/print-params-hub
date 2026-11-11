import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateBulkPosts, validateGroupTargets, validateLiveAutomation, validateSocialPost } from "./social.ts";

const NOW = Date.parse("2026-11-11T12:00:00Z");
const img = { url: "https://x.supabase.co/storage/v1/object/public/wa-media/a.jpg", type: "image" };
const vid = { url: "https://x.supabase.co/storage/v1/object/public/wa-media/b.mp4", type: "video" };
const G1 = "00000000-0000-4000-8000-000000000001";

Deno.test("post: agendado no futuro vira 'scheduled'; publicar agora vira 'publishing'", () => {
  const a = validateSocialPost({ caption: "Oi", media_items: [img], channels: [{ platform: "instagram", format: "Feed" }], scheduled_at: "2026-11-12T13:30:00.000Z" }, NOW);
  assertEquals(a.row?.status, "scheduled");
  assertEquals(a.row?.timezone, "America/Sao_Paulo");
  const b = validateSocialPost({ caption: "Oi", channels: [{ platform: "facebook", format: "Post" }], publish_now: true }, NOW);
  assertEquals(b.row?.status, "publishing");
});

Deno.test("post: mesmas exigências da tela", () => {
  const past = validateSocialPost({ caption: "Oi", channels: [{ platform: "facebook", format: "Post" }], scheduled_at: "2026-11-10T10:00:00Z" }, NOW);
  assert(past.errors.includes("O agendamento precisa ser no futuro."));
  const yt = validateSocialPost({ caption: "Oi", media_items: [img], channels: [{ platform: "youtube", format: "Shorts" }], publish_now: true }, NOW);
  assert(yt.errors.includes("youtube exige vídeo."));
  assert(yt.errors.includes("youtube: título obrigatório."));
  const empty = validateSocialPost({ caption: "", channels: [{ platform: "facebook", format: "Post" }], publish_now: true }, NOW);
  assert(empty.errors.includes("O post precisa de legenda ou mídia."));
  const tags = validateSocialPost({ caption: "x", hashtags: Array.from({ length: 31 }, (_, i) => `h${i}`), channels: [{ platform: "facebook", format: "Post" }], publish_now: true }, NOW);
  assert(tags.errors.includes("Máximo de 30 hashtags."));
  const reddit = validateSocialPost({ caption: "x", channels: [{ platform: "reddit", format: "Texto", title: "T", subreddit: "r/Den tistry" }], publish_now: true }, NOW);
  assert(reddit.errors.includes("Reddit: subreddit inválido."));
  const collabs = validateSocialPost({ caption: "x", media_items: [img], channels: [{ platform: "instagram", format: "Feed", collaborators: ["a", "b", "c", "d"] }], publish_now: true }, NOW);
  assert(collabs.errors.includes("Instagram: no máximo 3 colaboradores."));
});

Deno.test("agendamento em massa: uma mídia por post, nunca 'publicar agora', limite de 30", () => {
  const ok = validateBulkPosts({ posts: [
    { caption: "A", media_items: [img], channels: [{ platform: "instagram", format: "Feed" }], scheduled_at: "2026-11-12T21:00:00Z", post_type: "feed" },
    { caption: "B", media_items: [vid], channels: [{ platform: "instagram", format: "Reels", ig_share_to_feed: false }], scheduled_at: "2026-11-14T21:00:00Z", post_type: "reels" },
  ] }, NOW);
  assertEquals(ok.row?.length, 2);
  assertEquals((ok.row![1].channels as any[])[0].ig_share_to_feed, false);
  const now = validateBulkPosts({ posts: [{ caption: "A", media_items: [img], channels: [{ platform: "facebook", format: "Post" }], publish_now: true }] }, NOW);
  assert(now.errors[0].includes("não publica na hora"));
  const many = validateBulkPosts({ posts: Array.from({ length: 31 }, () => ({})) }, NOW);
  assert(many.errors[0].includes("Máximo de 30"));
});

Deno.test("Post Grupos: instância, grupos e redes", () => {
  const ok = validateGroupTargets({ instance_name: "cs_principal", enabled: true, group_ids: [G1, G1], platforms: ["instagram"] });
  assertEquals(ok.row?.group_ids, [G1]);
  const bad = validateGroupTargets({ instance_name: "cs_principal", enabled: true, group_ids: [G1], platforms: [] });
  assert(bad.errors.includes("Escolha pelo menos uma rede social."));
  const onlyToggle = validateGroupTargets({ instance_name: "cs_principal", enabled: false, group_ids: [], platforms: [] });
  assertEquals(onlyToggle.errors, []);
});

Deno.test("Automação de lives: grupo obrigatório e pelo menos um envio", () => {
  const base = { name: "Divulgação de Lives", group_ids: [G1], course_ids: [], promo_enabled: true, promo_days_before: 1, promo_time: "08:30", promo_template: "Texto da propaganda", live_enabled: false, live_minutes_before: 5, live_template: "", enabled: true };
  assertEquals(validateLiveAutomation(base).row?.promo_time, "08:30");
  assert(validateLiveAutomation({ ...base, promo_enabled: false }).errors.includes("Ative a propaganda ou o lembrete ao vivo."));
  assert(validateLiveAutomation({ ...base, group_ids: [] }).errors.includes("Escolha pelo menos um grupo."));
  assert(validateLiveAutomation({ ...base, promo_time: "8h" }).errors.includes("Horário da propaganda inválido."));
});

Deno.test("permissões: posts e Post Grupos só admin; lives para qualquer usuário do Copilot", async () => {
  const { wizardAllowed } = await import("./guided.ts");
  const user = { sb: null, userId: "u", supabaseUrl: "", serviceKey: "", isAdmin: false };
  assertEquals(wizardAllowed(user, "post_social").allowed, false);
  assertEquals(wizardAllowed(user, "posts_massa").allowed, false);
  assertEquals(wizardAllowed(user, "post_grupos").allowed, false);
  assertEquals(wizardAllowed(user, "automacao_lives").allowed, true);
  assertEquals(wizardAllowed({ ...user, isAdmin: true }, "post_social").allowed, true);
});
