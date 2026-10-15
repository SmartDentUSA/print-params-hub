/**
 * kol-course-reels-publish
 * Pipeline do vídeo vertical do curso do KOL (mesmo caminho dos depoimentos):
 *  1) Gera a palavra-gatilho = 3 iniciais do subtítulo/chamada (fallback: título).
 *  2) Cria/atualiza o IG Flow (social_flows + social_triggers) com 3 DMs e respostas
 *     públicas, enviando o link curto do curso.
 *  3) Se o curso está publicado: ativa o flow na Zernio e publica Instagram Reels
 *     (KOL como colaborador), Instagram Story, Facebook Reels, Facebook Story,
 *     TikTok e YouTube Shorts (com título), com 5 hashtags do nicho.
 * Idempotente: um curso gera UMA publicação (reels_social_post_id), salvo force.
 * Acesso: service role (upload) ou equipe interna (fn_is_internal_staff).
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { chat, parseJsonBlock, normalizeForMatch } from "../_shared/testimonial-pipeline.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUBLIC_SITE = "https://parametros.smartdent.com.br";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const STOP = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "com", "a", "o", "as", "os", "na", "no", "um", "uma", "seu", "sua"]);

export function triggerKeyword(text: string): string {
  const words = String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const sig = words.filter((w) => !STOP.has(w.toLowerCase()));
  const base = (sig.length >= 3 ? sig : words).slice(0, 3).map((w) => w[0]).join("").toUpperCase();
  return base.padEnd(3, "X");
}

function dmMessages(curso: string, link: string): string[] {
  return [
    [`Olá! Que bom que você se interessou pelo ${curso}!`, "Abaixo segue o link onde você terá todas as informações. Qualquer dúvida, estamos à disposição.", `Link: ${link}`].join("\n\n"),
    [`Oi! Vi seu comentário sobre o ${curso} 😊`, "Separei tudo pra você neste link — informações completas, e se precisar de ajuda me chama por aqui.", `Link: ${link}`].join("\n\n"),
    [`Olá! Aqui estão as informações do ${curso} que você pediu.`, "Dá uma olhada no link abaixo e qualquer dúvida responde essa mensagem que a gente te ajuda.", `Link: ${link}`].join("\n\n"),
  ];
}
const REPLIES = [
  "Acabei de mandar as informações na sua DM! 📩",
  "Prontinho, já te enviei tudo no direct 📲",
  "Enviei agora as informações no seu direct — confere lá! 👀",
  "Respondi no direct com todos os detalhes 💬",
];
const handleOf = (s?: string | null) => {
  const h = String(s || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?\s]/)[0];
  return /^[A-Za-z0-9._]{2,30}$/.test(h) ? h : null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const auth = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  let actor = "system";
  if (auth !== SERVICE_KEY) {
    const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: `Bearer ${auth}` } } });
    const { data: { user } } = await sb.auth.getUser(auth);
    if (!user) return json({ error: "Não autenticado" }, 401);
    const { data: staff } = await sb.rpc("fn_is_internal_staff");
    if (!staff) return json({ error: "Acesso restrito à equipe" }, 403);
    actor = user.email || user.id;
  }

  let courseId = "";
  try {
    const body = await req.json().catch(() => ({} as any));
    courseId = String(body?.course_id || "");
    const force = body?.force === true;
    const dryRun = body?.dry_run === true;
    if (!/^[0-9a-f-]{36}$/i.test(courseId)) return json({ error: "course_id obrigatório" }, 400);

    const { data: c, error } = await db.from("professional_courses").select("*").eq("id", courseId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) return json({ error: "Curso não encontrado" }, 404);
    if (!c.reels_storage_path) return json({ status: "skipped", reason: "sem vídeo vertical enviado pelo upload" });

    const { data: lead } = await db.from("lia_attendances")
      .select("id, nome, prof_display_name, instagram, especialidade")
      .eq("id", c.producer_lead_id).is("merged_into", null).maybeSingle();
    const profName = String(lead?.prof_display_name || lead?.nome || "Profissional").trim();
    const kolHandle = handleOf(c.instagram) || handleOf(lead?.instagram);

    // ── 1) Palavra-gatilho única ─────────────────────────────────────────
    let keyword = c.ig_trigger_keyword || triggerKeyword(c.subtitle || c.title);
    if (!c.ig_trigger_keyword) {
      const { data: others } = await db.from("social_flows").select("form_name, zernio_automation_config");
      const used = new Set<string>();
      (others ?? []).forEach((f: any) => {
        if (f.form_name === `kol_course:${courseId}`) return;
        (f.zernio_automation_config?.keywords ?? []).forEach((k: string) => used.add(String(k).toUpperCase()));
      });
      const { data: forms } = await db.from("smartops_forms").select("ig_trigger_keyword").not("ig_trigger_keyword", "is", null);
      (forms ?? []).forEach((f: any) => used.add(String(f.ig_trigger_keyword).toUpperCase()));
      let n = 2;
      const base = keyword;
      while (used.has(keyword)) keyword = `${base}${n++}`;
    }

    // ── 2) Link curto do curso ───────────────────────────────────────────
    const target = `${PUBLIC_SITE}/base-conhecimento?tab=cursos&curso=${encodeURIComponent(courseId)}`;
    let link = target;
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/short-link-create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ destination_url: target }),
      });
      const d = await r.json().catch(() => null);
      if (r.ok && d?.url) link = d.url;
    } catch { /* usa o link completo */ }

    const published = c.status === "publicado" && c.public_visible !== false;
    const dms = dmMessages(c.title, link);
    const flowPayload: any = {
      name: `DM IG — Curso KOL — ${c.title}`.slice(0, 200),
      description: `Palavra-gatilho "${keyword}" → DM com link ${link} (curso de ${profName})`,
      channel: "instagram",
      is_active: published,
      nodes: [
        { id: "dm", type: "default", position: { x: 120, y: 80 }, data: { label: `DM com link — ${c.title}`, nodeType: "send_dm", config: { message: dms[0] } } },
        { id: "end", type: "default", position: { x: 120, y: 240 }, data: { label: "Fim", nodeType: "end", config: {} } },
      ],
      edges: [{ id: "e-dm-end", source: "dm", target: "end" }],
      produto_nome: c.title,
      produto_categoria: c.category,
      form_name: `kol_course:${courseId}`,
      zernio_automation_config: {
        keywords: [keyword], dm_message: dms[0], dm_message_variations: dms.slice(1),
        comment_reply: REPLIES[0], comment_reply_variations: REPLIES.slice(1),
        short_link: link, short_link_target: "kol_course", course_id: courseId,
      },
      updated_at: new Date().toISOString(),
    };

    // ── Copy (IA) ────────────────────────────────────────────────────────
    const cta = `Digite "${keyword}" nos comentários e receba as informações na sua DM.`;
    const prompt = [
      `Você é social media sênior da Smart Dent (odontologia digital). Escreva a copy de um vídeo vertical de divulgação`,
      `do curso de um profissional parceiro (KOL), com voz HUMANA, sem tom institucional, sem "revolucionar"/"inovador".`,
      `Modelo de estrutura: gancho forte com pergunta → apresentação do curso e do professor → o que a pessoa vai aprender (tópicos curtos com emoji) → CTA de comentário.`,
      ``,
      `DADOS REAIS (não invente nada além disso):`,
      `- Curso: ${c.title}`,
      `- Chamada/subtítulo: ${c.subtitle || "não informado"}`,
      `- Professor: ${profName}${kolHandle ? ` (@${kolHandle})` : ""}${lead?.especialidade ? `, ${lead.especialidade}` : ""}`,
      `- Modalidade: ${c.modality || "não informado"} | Categoria: ${c.category || "não informado"}`,
      `- Local/cidade: ${[c.city, c.state].filter(Boolean).join("/") || "não informado"} | Datas: ${c.start_date || "não informado"}${c.end_date ? ` a ${c.end_date}` : ""}`,
      `- Carga horária: ${c.workload_hours ?? "não informado"} h | Público: ${c.target_audience || "não informado"}`,
      `- Descrição: ${String(c.description || "").slice(0, 1500)}`,
      `- Conteúdo programático: ${JSON.stringify(c.syllabus || []).slice(0, 1500)}`,
      ``,
      `REGRAS: proibido preço/valores/promessa clínica; no máx. 5 emojis; terminar SEMPRE com a linha: ${cta}`,
      kolHandle ? `Mencione @${kolHandle} na apresentação do professor.` : `Não cite @ do professor.`,
      `Responda SOMENTE JSON: {"reels_caption":"até 1500 chars","story_caption":"até 220 chars","facebook_caption":"versão para Facebook, diferente da do Reels","tiktok_caption":"nativa TikTok, gancho ≤60 chars na 1ª linha, diferente das outras","youtube_title":"título do Shorts até 90 chars","hashtags":["exatamente 5 hashtags do nicho do curso, sem #, CamelCase"]}`,
    ].join("\n");
    const raw = await chat([
      { role: "system", content: "Você escreve copies honestas para redes sociais odontológicas B2B em português do Brasil." },
      { role: "user", content: prompt },
    ], { json: true });
    const copy = parseJsonBlock<any>(raw);
    const withCta = (s: string) => (s.includes(`"${keyword}"`) ? s.trim() : `${s.trim()}\n\n${cta}`);
    const reels = withCta(String(copy.reels_caption || ""));
    const story = withCta(String(copy.story_caption || c.subtitle || c.title).slice(0, 220));
    let fb = withCta(String(copy.facebook_caption || ""));
    if (!copy.facebook_caption || normalizeForMatch(fb) === normalizeForMatch(reels)) fb = withCta(`${c.title}${c.subtitle ? ` — ${c.subtitle}` : ""}\nCom ${profName}.`);
    let tiktok = withCta(String(copy.tiktok_caption || ""));
    if (!copy.tiktok_caption || normalizeForMatch(tiktok) === normalizeForMatch(reels)) tiktok = withCta(`${c.subtitle || c.title}\nCurso com ${profName} 🎓`);
    const ytTitle = String(copy.youtube_title || `${c.title} | ${profName}`).slice(0, 100);
    const hashtags = (Array.isArray(copy.hashtags) ? copy.hashtags : [])
      .map((h: unknown) => String(h).replace(/^#/, "").replace(/\s+/g, "")).filter(Boolean).slice(0, 5);

    if (dryRun) return json({ status: "dry_run", keyword, link, published, reels, story, fb, tiktok, ytTitle, hashtags, collaborator: kolHandle });

    // ── Flow (sempre criado; ativo só com curso publicado) ───────────────
    const { data: existing } = await db.from("social_flows").select("id").eq("form_name", `kol_course:${courseId}`).maybeSingle();
    let flowId = existing?.id ?? null;
    if (flowId) await db.from("social_flows").update(flowPayload).eq("id", flowId);
    else {
      const { data: ins, error: fe } = await db.from("social_flows").insert(flowPayload).select("id").single();
      if (fe) throw new Error(`Flow: ${fe.message}`);
      flowId = ins.id;
    }
    const { data: trg } = await db.from("social_triggers").select("id, trigger_type").eq("flow_id", flowId);
    const byType = new Map((trg ?? []).map((t: any) => [t.trigger_type, t.id]));
    for (const type of ["comment_keyword", "dm_keyword"]) {
      const p = { flow_id: flowId, trigger_type: type, keywords: [keyword], is_regex: false, priority: 10 };
      const id = byType.get(type);
      if (id) await db.from("social_triggers").update(p).eq("id", id); else await db.from("social_triggers").insert(p);
    }

    const snapshot = { keyword, link, reels, story, facebook: fb, tiktok, youtube_title: ytTitle, hashtags, collaborator: kolHandle, prof_name: profName };
    await db.from("professional_courses").update({ ig_trigger_keyword: keyword, reels_flow_id: flowId, reels_social_snapshot: snapshot }).eq("id", courseId);

    const log = (type: string, desc: string, data: Record<string, unknown> = {}) =>
      db.rpc("fn_kol_log", {
        _lead_id: c.producer_lead_id, _event_type: type, _entity_type: "professional_course", _entity_id: courseId,
        _entity_name: c.title, _value: null, _channel: "kol", _data: { descricao: desc, actor, ...data },
      }).then(() => null, () => null);

    if (!published) {
      await db.from("professional_courses").update({ reels_social_status: "awaiting_course_publish", reels_social_error: null }).eq("id", courseId);
      await log("kol_course_reels_flow_ready", `IG Flow criado com a palavra ${keyword}; publicação nas redes aguarda o curso ser publicado`, { keyword });
      return json({ status: "awaiting_course_publish", keyword, flow_id: flowId, link });
    }
    if (c.reels_social_post_id && !force) return json({ status: "already_published", post_id: c.reels_social_post_id, keyword });

    // Ativa a automação comentário→DM na Zernio
    await fetch(`${SUPABASE_URL}/functions/v1/zernio-provision-flow`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ flow_id: flowId, resync: true }),
    }).catch((e) => console.error("[zernio]", e));

    // ── 3) Publicação ────────────────────────────────────────────────────
    const { data: signed, error: se } = await db.storage.from("kol-course-reels").createSignedUrl(c.reels_storage_path, 60 * 60 * 24);
    if (se || !signed?.signedUrl) throw new Error(`URL do vídeo: ${se?.message || "indisponível"}`);
    const media = [{ url: signed.signedUrl, type: "video" }];
    const channels = [
      { platform: "instagram", format: "reels", ...(kolHandle ? { collaborators: [kolHandle] } : {}) },
      { platform: "instagram", format: "stories", caption: story, ...(kolHandle ? { userTags: [{ username: kolHandle }] } : {}) },
      { platform: "facebook", format: "reels", caption: fb },
      { platform: "facebook", format: "stories", caption: story },
      { platform: "tiktok", format: "video", caption: tiktok },
      { platform: "youtube", format: "Shorts", title: ytTitle, caption: reels, platformSpecificData: { title: ytTitle, privacyStatus: "public", madeForKids: false } },
    ];
    const nowIso = new Date().toISOString();
    const { data: post, error: pe } = await db.from("social_scheduled_posts").insert({
      status: "scheduled", publish_now: true, scheduled_at: nowIso, post_type: "reels",
      caption: reels, hashtags, media_items: media,
      per_channel_media: { instagram: media, facebook: media, tiktok: media, youtube: media },
      channels, product_name: c.title, created_by: "kol-course-reels-publish",
    }).select("id").single();
    if (pe) throw new Error(`Publicação: ${pe.message}`);

    await db.from("professional_courses").update({
      reels_social_status: "queued", reels_social_post_id: post.id, reels_social_error: null, reels_social_published_at: nowIso,
    }).eq("id", courseId);
    await log("kol_course_reels_queued", `Vídeo vertical enviado às redes (IG Reels/Story, FB Reels/Story, TikTok, YouTube Shorts); palavra ${keyword}`, { post_id: post.id, keyword });

    fetch(`${SUPABASE_URL}/functions/v1/social-publish-worker`, {
      method: "POST", headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY, "Content-Type": "application/json" }, body: "{}",
    }).catch(() => null);

    return json({ status: "queued", post_id: post.id, keyword, flow_id: flowId, link, collaborator: kolHandle });
  } catch (e) {
    const msg = String((e as Error).message || e);
    console.error("[kol-course-reels-publish]", msg);
    if (courseId) await db.from("professional_courses").update({ reels_social_status: "error", reels_social_error: msg.slice(0, 1000) }).eq("id", courseId);
    return json({ error: msg }, 500);
  }
});
