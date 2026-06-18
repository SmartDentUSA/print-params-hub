import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VERCEL_URL = Deno.env.get("VERCEL_URL") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const LOGO_WHITE_URL = `${SUPABASE_URL}/storage/v1/object/public/wa-media/brand/logo-smart-dent-branco.png`;
const LOGO_COLOR_URL = `${SUPABASE_URL}/storage/v1/object/public/wa-media/brand/logo-smart-dent.png`;

const BodySchema = z.object({
  run_id: z.string().uuid(),
  slide: z.number().int().min(1).max(9).optional(),
});

const SELF_URL = `${SUPABASE_URL}/functions/v1/training-factory-carousel`;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";

const MESES = ["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];

function escapeHtml(s: string): string {
  return (s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
function truncate(s: string, n: number): string {
  const t = (s||"").trim();
  return t.length <= n ? t : t.slice(0, n-1).trimEnd() + "…";
}
function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf); let bin = ""; const CH = 0x8000;
  for (let i=0; i<bytes.length; i+=CH) bin += String.fromCharCode(...bytes.subarray(i, i+CH));
  return btoa(bin);
}
function normalizeDriveUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (/(^|\.)googleusercontent\.com$/i.test(u.hostname) || /(^|\.)drive\.google\.com$/i.test(u.hostname)) {
      u.searchParams.delete("sz"); u.searchParams.set("sz", "w1200");
    }
    return u.toString();
  } catch { return url; }
}
async function urlToBase64(url: string): Promise<string> {
  if (!url) return "";
  try {
    const res = await fetch(normalizeDriveUrl(url));
    if (!res.ok) { console.warn(`urlToBase64 ${res.status} ${url}`); return ""; }
    const buf = await res.arrayBuffer();
    const ct = res.headers.get("content-type") || "image/jpeg";
    return `data:${ct};base64,${bufToB64(buf)}`;
  } catch (e) { console.warn("urlToBase64 err", e); return ""; }
}

async function renderViaVercel(html: string, width = 1080, height = 1080): Promise<Uint8Array> {
  const r = await fetch(`${VERCEL_URL.replace(/\/$/,"")}/api/render-template`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, width, height }),
  });
  if (!r.ok) throw new Error(`Vercel render ${r.status}: ${await r.text()}`);
  return new Uint8Array(await r.arrayBuffer());
}

async function geminiOneLiner(topico: string): Promise<string> {
  if (!LOVABLE_API_KEY || !topico) return "";
  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você escreve descrições curtas (1 frase, máx 90 caracteres) para slides de curso de odontologia digital. Tom prático, direto, sem clichês. Responda SOMENTE a frase." },
          { role: "user", content: `Tópico: ${topico}` },
        ],
      }),
    });
    if (!r.ok) return "";
    const j = await r.json();
    return (j?.choices?.[0]?.message?.content || "").trim().replace(/^["']|["']$/g, "");
  } catch { return ""; }
}

const LOGO_WHITE_SVG = `<svg width="160" height="48" viewBox="0 0 200 60" xmlns="http://www.w3.org/2000/svg">
  <path d="M18 8 Q8 8 8 18 Q8 35 18 42 Q28 35 28 18 Q28 8 18 8Z" fill="white" opacity="0.9"/>
  <path d="M18 8 Q28 4 34 12 Q38 20 28 28" fill="none" stroke="white" stroke-width="3" opacity="0.9"/>
  <text x="40" y="28" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="white" letter-spacing="2">SMART DENT</text>
</svg>`;

// ────────── SLIDES ──────────
const COMMON_CSS = `*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1080px;font-family:'Helvetica Neue',Arial,sans-serif;position:relative;overflow:hidden;background:#fff;}
.badge{position:absolute;top:40px;left:40px;background:#E8821A;color:#fff;font-size:22px;font-weight:800;padding:8px 18px;border-radius:6px;letter-spacing:2px;z-index:5;}
.logo-tr{position:absolute;top:40px;right:40px;width:160px;z-index:5;}
.logo-tr svg,.logo-tr img{width:100%;height:auto;display:block;}
.foot-logo svg,.foot-logo img{width:100%;height:auto;display:block;}`;

function slideCapa(p: { num: string; fotoGrupoB64: string; mesAno: string }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${COMMON_CSS}
.logo-tr{top:32px;right:32px;}
body{background:#0A0F1E;color:#fff;}
.bg{position:absolute;inset:0;background:url('${p.fotoGrupoB64}') center/cover no-repeat;}
.overlay-top{position:absolute;top:0;left:0;right:0;height:65%;background:linear-gradient(to bottom,rgba(0,0,0,0.1),rgba(0,0,0,0));}
.overlay-bottom{position:absolute;bottom:0;left:0;right:0;height:45%;background:linear-gradient(to top,rgba(0,0,0,0.88),rgba(0,0,0,0));}
.content{position:absolute;bottom:48px;left:48px;right:48px;}
.label{font-size:20px;letter-spacing:4px;color:rgba(255,255,255,0.85);margin-bottom:10px;}
.h1{font-size:52px;font-weight:900;color:#E8821A;line-height:1;margin-bottom:8px;}
.brand{font-size:26px;font-weight:300;letter-spacing:3px;margin-bottom:28px;}
.icons{display:flex;gap:28px;color:rgba(255,255,255,0.9);font-size:14px;letter-spacing:1px;margin-bottom:22px;flex-wrap:wrap;}
.icons span{display:inline-flex;align-items:center;gap:8px;}
.local{color:rgba(255,255,255,0.75);font-size:18px;letter-spacing:1px;}
</style></head><body>
<div class="bg"></div><div class="overlay-top"></div><div class="overlay-bottom"></div>
<div class="badge">${escapeHtml(p.num)}</div>
<div class="logo-tr">${LOGO_WHITE_SVG}</div>
<div class="content">
  <div class="label">CURSO IMERSIVO</div>
  <div class="h1">ODONTOLOGIA DIGITAL</div>
  <div class="brand">SMART DENT</div>
  <div class="icons">
    <span>🎓 CONHECIMENTO APLICADO</span>
    <span>🏅 CERTIFICAÇÃO DE QUALIDADE</span>
    <span>🦷 CASOS REAIS E TECNOLOGIA</span>
  </div>
  <div class="local">📍 São Carlos – SP &nbsp;|&nbsp; ${escapeHtml(p.mesAno)}</div>
</div>
</body></html>`;
}

function slideCertificado(p: { num: string; fotoB64: string; quote: string; logoColor: string }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${COMMON_CSS}
.title-wrap{position:absolute;top:170px;left:0;right:0;text-align:center;}
.t-label{color:#5b6470;font-size:18px;letter-spacing:6px;font-weight:600;margin-bottom:6px;}
.t-main{color:#E8821A;font-size:64px;font-style:italic;font-family:Georgia,serif;font-weight:700;display:inline-flex;align-items:center;gap:14px;}
.foto{position:absolute;top:320px;left:50%;transform:translateX(-50%);width:480px;height:480px;border-radius:10px;background:#eee center/cover no-repeat;box-shadow:0 8px 30px rgba(0,0,0,0.15);}
.quote{position:absolute;bottom:120px;left:80px;right:80px;text-align:center;color:#2b2f36;font-size:20px;font-style:italic;line-height:1.5;}
.q-mark{color:#E8821A;font-size:28px;font-weight:700;}
.foot-logo{position:absolute;bottom:36px;right:40px;width:130px;opacity:0.85;}
</style></head><body>
<div class="badge">${escapeHtml(p.num)}</div>
<img class="logo-tr" src="${p.logoColor}" />
<div class="title-wrap">
  <div class="t-label">CERTIFICADO</div>
  <div class="t-main">🏅 Concluído!</div>
</div>
<div class="foto" style="background-image:url('${p.fotoB64}');"></div>
<div class="quote"><span class="q-mark">“</span> ${escapeHtml(p.quote)} <span class="q-mark">”</span></div>
<img class="foot-logo" src="${p.logoColor}" />
</body></html>`;
}

function slideConhecimento(p: { num: string; dias: Array<{ icon: string; titulo: string; desc: string }>; logoColor: string }) {
  const blocos = p.dias.map(d => `
  <div class="bloco">
    <div class="icon">${d.icon}</div>
    <div class="b-title">${escapeHtml(d.titulo)}</div>
    <div class="b-desc">${escapeHtml(d.desc)}</div>
  </div>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${COMMON_CSS}
.titulo{position:absolute;top:160px;left:60px;right:60px;font-size:34px;font-weight:900;color:#0a0f1e;line-height:1.15;}
.titulo .or{color:#E8821A;display:block;}
.blocos{position:absolute;top:340px;left:60px;right:60px;display:flex;flex-direction:column;gap:36px;}
.bloco{display:flex;align-items:flex-start;gap:24px;}
.icon{flex:0 0 64px;height:64px;background:#fff5e8;color:#E8821A;border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:32px;}
.b-title{font-size:22px;font-weight:800;color:#0a0f1e;margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;}
.b-desc{font-size:17px;color:#4a5560;line-height:1.45;}
.rodape{position:absolute;bottom:60px;left:60px;right:60px;text-align:center;color:#E8821A;font-style:italic;font-size:19px;font-weight:500;}
.foot-logo{position:absolute;bottom:16px;right:40px;width:110px;opacity:0.6;}
</style></head><body>
<div class="badge">${escapeHtml(p.num)}</div>
<img class="logo-tr" src="${p.logoColor}" />
<div class="titulo">CONHECIMENTO QUE<span class="or">TRANSFORMA</span></div>
<div class="blocos">${blocos}</div>
<div class="rodape">Mais eficiência. Mais previsibilidade. Melhores resultados.</div>
<img class="foot-logo" src="${p.logoColor}" />
</body></html>`;
}

function slideParticipante(p: { num: string; fotoB64: string; nome: string; especialidade: string; quote: string; logoColor: string }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${COMMON_CSS}
.foto{position:absolute;top:0;left:0;width:540px;height:1080px;background:#eee center/cover no-repeat;background-image:url('${p.fotoB64}');}
.right{position:absolute;top:0;left:540px;width:540px;height:1080px;padding:60px 48px;display:flex;flex-direction:column;}
.logo-c{width:150px;margin-bottom:auto;}
.nome{color:#E8821A;font-size:28px;font-weight:900;text-transform:uppercase;line-height:1.1;letter-spacing:1px;}
.espec{color:#6a7380;font-size:16px;margin-top:6px;}
.sep{width:60px;height:3px;background:#E8821A;margin:22px 0 18px;}
.q-mark{color:#E8821A;font-size:54px;line-height:0.6;font-family:Georgia,serif;font-weight:700;}
.quote{color:#2b2f36;font-size:16px;font-style:italic;line-height:1.55;margin-top:12px;}
</style></head><body>
<div class="foto"></div>
<div class="badge">${escapeHtml(p.num)}</div>
<div class="right">
  <img class="logo-c" src="${p.logoColor}" />
  <div class="nome">${escapeHtml(p.nome)}</div>
  <div class="espec">${escapeHtml(p.especialidade)}</div>
  <div class="sep"></div>
  <div class="q-mark">“</div>
  <div class="quote">${escapeHtml(p.quote)}</div>
</div>
</body></html>`;
}

function slideCTA(p: { num: string }) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${COMMON_CSS}
body{background:linear-gradient(135deg,#1a1a2e 0%,#2d2d44 100%);color:#fff;}
.icon-top{position:absolute;top:200px;left:0;right:0;text-align:center;font-size:96px;}
.h1{position:absolute;top:340px;left:0;right:0;text-align:center;font-size:42px;font-weight:900;letter-spacing:2px;}
.h2{position:absolute;top:400px;left:0;right:0;text-align:center;font-size:36px;color:#E8821A;font-style:italic;font-family:Georgia,serif;}
.btns{position:absolute;top:540px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:18px;}
.btn{background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:999px;padding:18px 36px;font-size:18px;font-weight:700;letter-spacing:2px;display:inline-flex;align-items:center;gap:14px;color:#fff;min-width:420px;justify-content:center;}
.foot-logo{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);width:170px;}
</style></head><body>
<div class="badge">${escapeHtml(p.num)}</div>
<div class="icon-top">🎓</div>
<div class="h1">PRÓXIMA TURMA</div>
<div class="h2">em breve!</div>
<div class="btns">
  <div class="btn">📅 GARANTE SUA VAGA</div>
  <div class="btn">💬 ENTRE EM CONTATO</div>
  <div class="btn">@ SMARTDENTOFICIAL</div>
</div>
<div class="foot-logo">${LOGO_WHITE_SVG}</div>
</body></html>`;
}

// ────────── HANDLER ──────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!VERCEL_URL) throw new Error("VERCEL_URL não configurado");
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { run_id } = parsed.data;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1) run
    const { data: run, error: runErr } = await supabase
      .from("training_factory_runs").select("*").eq("id", run_id).maybeSingle();
    if (runErr || !run) throw new Error(`run não encontrada: ${runErr?.message}`);
    const turmaNumber: number = run.turma_number;
    const mediaUploaded: any = run.media_uploaded ?? {};
    const fotoGrupoUrl: string = mediaUploaded?.foto_grupo || "";
    const dia1Photos: string[] = mediaUploaded?.dia1 || mediaUploaded?.fotos_dia1 || [];
    const dia2Photos: string[] = mediaUploaded?.dia2 || mediaUploaded?.fotos_dia2 || [];
    const dia3Photos: string[] = mediaUploaded?.dia3 || mediaUploaded?.fotos_dia3 || [];
    const allDiaPhotos = [...dia1Photos, ...dia2Photos, ...dia3Photos];

    // 2) factory data
    const { data: factoryData } = await supabase.rpc("fn_get_turma_factory_data", { p_turma_id: run.turma_id });
    const fd: any = factoryData ?? {};
    const participantes: any[] = fd?.participantes || [];
    const dias: any[] = fd?.dias || fd?.turma_days || [];
    const tDia = (i: number) => dias[i]?.topico || dias[i]?.tema || dias[i]?.titulo || "";

    const now = new Date();
    const mesAno = `${MESES[now.getMonth()]} ${now.getFullYear()}`;

    // 3) assets (depoimentos / certificados)
    const { data: assets } = await supabase
      .from("training_factory_assets").select("*").eq("run_id", run_id);
    const depoimentos = (assets || []).filter((a: any) => a.asset_type === "depoimento");

    const requestedSlide = parsed.data.slide;
    const basePath = `training/${turmaNumber}/carousel`;

    // ───── Builder: monta HTML de UM slide específico (só carrega o que precisa) ─────
    async function buildSlideHtml(n: number): Promise<string> {
      let logoWhite = "";
      try {
        const resp = await fetch("https://okeogjgqijbfkudfjadz.supabase.co/storage/v1/object/public/wa-media/brand/logo-smart-dent-branco.png");
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          logoWhite = `data:image/png;base64,${bufToB64(buf)}`;
        }
      } catch {}
      if (!logoWhite) {
        const logoB64Raw = Deno.env.get("LOGO_BRANCO_B64") || "";
        if (logoB64Raw) logoWhite = `data:image/png;base64,${logoB64Raw}`;
      }
      const logoColor = (await urlToBase64(LOGO_COLOR_URL)) || logoWhite;
      if (n === 1) {
        const fotoGrupoB64 = await urlToBase64(fotoGrupoUrl);
        return slideCapa({ num: "01", fotoGrupoB64, mesAno, logoWhite });
      }
      if (n >= 2 && n <= 4) {
        const i = n - 2;
        const photoSrc = dia3Photos[i] || fotoGrupoUrl;
        const fotoB64 = await urlToBase64(photoSrc);
        const quote = truncate(depoimentos[i]?.transcription || "Experiência marcante de aprendizado prático e aplicável.", 80);
        return slideCertificado({ num: String(n).padStart(2, "0"), fotoB64, quote, logoColor });
      }
      if (n === 5) {
        const topicos = [tDia(0), tDia(1), tDia(2)];
        const descs = await Promise.all(topicos.map(t => geminiOneLiner(t)));
        const ICON_MONITOR = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#E8821A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;
        const ICON_TOOTH = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#E8821A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2C8 2 5 4 5 8c0 3 1 5 1.5 8 .3 2 .7 4 2 4 1.2 0 1.5-2 2-4.5.2-1 .8-1.5 1.5-1.5s1.3.5 1.5 1.5C14 18 14.3 20 15.5 20c1.3 0 1.7-2 2-4 .5-3 1.5-5 1.5-8 0-4-3-6-7-6z"/></svg>`;
        const ICON_PRINTER = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#E8821A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="9" rx="2"/><rect x="7" y="14" width="10" height="7"/></svg>`;
        const dias05 = [
          { icon: ICON_MONITOR, titulo: topicos[0] || "Planejamento Digital", desc: descs[0] || "Domine o fluxo digital do diagnóstico ao planejamento." },
          { icon: ICON_TOOTH, titulo: topicos[1] || "CAD Clínico", desc: descs[1] || "Desenhe restaurações com precisão e velocidade clínica." },
          { icon: ICON_PRINTER, titulo: topicos[2] || "Impressão Chairside", desc: descs[2] || "Imprima e entregue no mesmo dia com previsibilidade." },
        ];
        return slideConhecimento({ num: "05", dias: dias05, logoColor });
      }
      if (n >= 6 && n <= 8) {
        const i = n - 6;
        const dep = depoimentos[i];
        const matchPart = dep
          ? participantes.find((p: any) => p.enrollment_id === dep.enrollment_id || p.nome === dep.participant_name) || {}
          : (participantes[i] || {});
        const partName = (dep?.participant_name || matchPart?.nome || "Participante").toUpperCase();
        const espec = matchPart?.especialidade || matchPart?.especialidade_nome || "Dentista";
        const quote = truncate(dep?.transcription || "Uma experiência transformadora que mudou minha prática clínica.", 180);
        const fotoSource = matchPart?.foto || matchPart?.foto_url || allDiaPhotos[i + 3] || allDiaPhotos[i] || fotoGrupoUrl;
        const fotoB64 = (await urlToBase64(fotoSource)) || (await urlToBase64(fotoGrupoUrl));
        return slideParticipante({ num: String(n).padStart(2, "0"), nome: partName, especialidade: espec, quote, fotoB64, logoColor });
      }
      // n === 9
      return slideCTA({ num: "09", logoWhite });
    }

    async function renderAndPersist(n: number) {
      const html = await buildSlideHtml(n);
      const png = await renderViaVercel(html, 1080, 1080);
      const storagePath = `${basePath}/slide_${String(n).padStart(2, "0")}.png`;
      const { error: upErr } = await supabase.storage.from("wa-media")
        .upload(storagePath, png, { contentType: "image/png", upsert: true });
      if (upErr) throw new Error(upErr.message);
      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/wa-media/${storagePath}`;
      const assetType = `carousel_slide_${String(n).padStart(2, "0")}`;
      const { data: existing } = await supabase
        .from("training_factory_assets")
        .select("id").eq("run_id", run_id).eq("asset_type", assetType).maybeSingle();
      let assetId = existing?.id;
      if (assetId) {
        await supabase.from("training_factory_assets")
          .update({ media_url: publicUrl, media_type: "image", media_width: 1080, media_height: 1080, status: "ready", updated_at: new Date().toISOString() })
          .eq("id", assetId);
      } else {
        const { data: ins } = await supabase.from("training_factory_assets")
          .insert({ run_id, turma_id: run.turma_id, turma_number: turmaNumber, asset_type: assetType, media_url: publicUrl, media_type: "image", media_width: 1080, media_height: 1080, status: "ready" })
          .select("id").maybeSingle();
        assetId = ins?.id;
      }
      return { slide: n, url: publicUrl, asset_id: assetId };
    }

    // ───── MODO 1: slide específico ─────
    if (requestedSlide) {
      const result = await renderAndPersist(requestedSlide);
      return new Response(JSON.stringify({ success: true, run_id, ...result }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ───── MODO 2: orquestrador — renderiza slide 01 + dispara 02..09 fire-and-forget ─────
    const slide01 = await renderAndPersist(1);

    const auth = ANON_KEY || SERVICE_ROLE;
    const dispatched: number[] = [];
    for (let n = 2; n <= 9; n++) {
      try {
        // fire-and-forget: não dá await na response, só dispara
        fetch(SELF_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${auth}`,
            "apikey": auth,
          },
          body: JSON.stringify({ run_id, slide: n }),
        }).catch((e) => console.warn(`dispatch slide ${n} falhou:`, e));
        dispatched.push(n);
      } catch (e) {
        console.warn(`dispatch slide ${n} erro:`, e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      run_id,
      slide_01: slide01,
      dispatched_async: dispatched,
      message: "Slide 01 renderizado; slides 02-09 disparados em background.",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("[training-factory-carousel] erro:", e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});