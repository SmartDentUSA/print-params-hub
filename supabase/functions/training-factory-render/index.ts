import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";

const LOGO_BRANCO =
  "https://okeogjgqijbfkudfjadz.supabase.co/storage/v1/object/public/wa-media/brand/logo-smart-dent-branco.png";

const BodySchema = z.object({ run_id: z.string().uuid() });

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

// Google Drive: força versão reduzida para evitar payloads > 2MB
function normalizeImageUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (/(^|\.)googleusercontent\.com$/i.test(u.hostname) ||
        /(^|\.)drive\.google\.com$/i.test(u.hostname)) {
      // remove sz/size existentes e força w1200
      u.searchParams.delete("sz");
      u.searchParams.set("sz", "w1200");
    }
    return u.toString();
  } catch {
    return url;
  }
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function urlToBase64(url: string): Promise<string> {
  if (!url) return "";
  try {
    const res = await fetch(normalizeImageUrl(url));
    if (!res.ok) return "";
    const buf = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${bufferToBase64(buf)}`;
  } catch {
    return "";
  }
}

function escapeHtml(s: string): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstWords(text: string, n: number): string {
  const words = (text || "").trim().split(/\s+/).filter(Boolean);
  if (words.length <= n) return words.join(" ");
  return words.slice(0, n).join(" ") + "...";
}

function feedHtml(p: {
  fotoGrupo: string;
  turmaNumber: number;
  equipamento: string;
  mesAno: string;
}) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1080px;background:#0A0F1E;font-family:Arial,sans-serif;position:relative;overflow:hidden;}
.bg{position:absolute;inset:0;background-image:url('${p.fotoGrupo}');background-size:cover;background-position:center;}
.overlay{position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.95) 50%,rgba(0,0,0,0.35) 100%);}
.badge{position:absolute;top:48px;left:48px;background:#E8821A;color:white;font-size:22px;font-weight:700;padding:8px 20px;border-radius:6px;letter-spacing:1px;}
.equipamento{position:absolute;top:108px;left:52px;color:rgba(255,255,255,0.7);font-size:18px;letter-spacing:4px;}
.content{position:absolute;bottom:0;left:0;right:0;padding:0 52px 52px;}
.curso-label{color:rgba(255,255,255,0.8);font-size:20px;letter-spacing:5px;font-weight:300;margin-bottom:8px;}
.curso-nome{color:#E8821A;font-size:58px;font-weight:900;line-height:1.1;margin-bottom:6px;}
.marca{color:white;font-size:28px;font-weight:400;margin-bottom:28px;letter-spacing:2px;}
.icons-row{display:flex;gap:40px;color:rgba(255,255,255,0.85);font-size:16px;margin-bottom:24px;}
.info-row{color:rgba(255,255,255,0.7);font-size:18px;letter-spacing:1px;}
.logo{position:absolute;bottom:48px;right:48px;width:140px;}
</style></head><body>
<div class="bg"></div><div class="overlay"></div>
<div class="badge">TURMA #${escapeHtml(String(p.turmaNumber))}</div>
<div class="equipamento">${escapeHtml(p.equipamento)}</div>
<div class="content">
<div class="curso-label">CURSO IMERSIVO</div>
<div class="curso-nome">ODONTOLOGIA DIGITAL</div>
<div class="marca">SMART DENT</div>
<div class="icons-row">
<span>🎓 Conhecimento Aplicado</span>
<span>🏆 Certificação de Qualidade</span>
<span>🦷 Casos Reais</span>
</div>
<div class="info-row">📍 São Carlos – SP &nbsp;|&nbsp; ${escapeHtml(p.mesAno)}</div>
</div>
<img class="logo" src="${LOGO_BRANCO}" />
</body></html>`;
}

function depoimentoHtml(p: {
  videoThumb: string;
  transcricaoCurta: string;
  cursoNome: string;
  nome: string;
  especialidade: string;
  cidade: string;
  estado: string;
}) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1080px;height:1920px;font-family:Arial,sans-serif;position:relative;overflow:hidden;background:#1E1450;}
.bg{position:absolute;inset:0;background-image:url('${p.videoThumb}');background-size:cover;background-position:center top;}
.overlay{position:absolute;inset:0;background:rgba(30,20,80,0.78);}
.logo{position:absolute;top:60px;left:60px;width:200px;}
.quote-block{position:absolute;top:50%;left:60px;right:60px;transform:translateY(-50%);}
.aspas{color:#E8821A;font-size:120px;line-height:0.5;margin-bottom:20px;}
.quote-text{color:white;font-size:38px;line-height:1.55;font-style:italic;}
.curso-bold{font-weight:900;font-style:normal;color:white;}
.participante{position:absolute;bottom:160px;left:60px;right:60px;}
.part-nome{color:white;font-size:32px;font-weight:700;}
.part-info{color:rgba(255,255,255,0.7);font-size:24px;margin-top:6px;}
.rodape{position:absolute;bottom:60px;left:0;right:0;text-align:center;color:rgba(255,255,255,0.5);font-size:18px;letter-spacing:5px;}
</style></head><body>
<div class="bg"></div><div class="overlay"></div>
<img class="logo" src="${LOGO_BRANCO}" />
<div class="quote-block">
<div class="aspas">"</div>
<div class="quote-text">${escapeHtml(p.transcricaoCurta)} <span class="curso-bold">${escapeHtml(p.cursoNome)}</span>"</div>
</div>
<div class="participante">
<div class="part-nome">${escapeHtml(p.nome)}</div>
<div class="part-info">${escapeHtml(p.especialidade)} · ${escapeHtml(p.cidade)}/${escapeHtml(p.estado)}</div>
</div>
<div class="rodape">TREINAMENTO CHAIRSIDE PRINT</div>
</body></html>`;
}

function linkedinHtml(p: {
  fotoTurma: string;
  turmaNumber: number;
  cursoNome: string;
  equipamento: string;
  total: number;
  estados: string;
}) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box;}
body{width:1920px;height:1080px;font-family:Arial,sans-serif;position:relative;overflow:hidden;background:#050A14;}
.bg{position:absolute;inset:0;background-image:url('${p.fotoTurma}');background-size:cover;background-position:center;}
.overlay{position:absolute;inset:0;background:linear-gradient(to right,rgba(5,10,20,0.92) 50%,rgba(5,10,20,0.15) 100%);}
.logo{position:absolute;top:60px;left:70px;width:180px;}
.content{position:absolute;bottom:80px;left:70px;right:50%;}
.subtitulo{color:rgba(255,255,255,0.6);font-size:22px;letter-spacing:4px;font-weight:300;margin-bottom:16px;}
.titulo{color:white;font-size:72px;font-weight:900;line-height:1.1;margin-bottom:24px;}
.info{color:#E8821A;font-size:24px;letter-spacing:2px;font-weight:600;}
</style></head><body>
<div class="bg"></div><div class="overlay"></div>
<img class="logo" src="${LOGO_BRANCO}" />
<div class="content">
<div class="subtitulo">TURMA #${escapeHtml(String(p.turmaNumber))} CONCLUÍDA</div>
<div class="titulo">${escapeHtml(p.cursoNome)}</div>
<div class="info">${escapeHtml(p.equipamento)} &nbsp;·&nbsp; ${p.total} profissionais &nbsp;·&nbsp; ${escapeHtml(p.estados)}</div>
</div>
</body></html>`;
}

async function renderViaVercel(
  vercelUrl: string,
  html: string,
  width: number,
  height: number,
): Promise<Uint8Array> {
  const res = await fetch(`${vercelUrl.replace(/\/$/, "")}/api/render-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ html, width, height }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Vercel render ${res.status}: ${txt}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const VERCEL_URL = Deno.env.get("VERCEL_URL");
    if (!VERCEL_URL) {
      return new Response(JSON.stringify({ error: "Missing VERCEL_URL env" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { run_id } = parsed.data;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // 1. Run
    const { data: run, error: runErr } = await supabase
      .from("training_factory_runs")
      .select("*")
      .eq("id", run_id)
      .maybeSingle();
    if (runErr || !run) throw new Error(`run not found: ${runErr?.message}`);

    const turmaNumber: number = run.turma_number;

    // 2. Factory data
    const { data: factoryData } = await supabase.rpc(
      "fn_get_turma_factory_data",
      { p_turma_id: run.turma_id },
    );
    const fd: any = factoryData ?? {};
    const cursoNome: string = fd?.curso?.nome || "Odontologia Digital";
    const rawEquip = fd?.curso?.equipamento || fd?.equipamento || "";
    const rawLabel = fd?.curso?.label || fd?.label || "";
    const extractEquip = (s: string) =>
      (s || "").match(/(?:BLZ\s+)?INO\s*\d+|RayShape\s*\w*/i)?.[0]?.trim() || "";
    const equipamento =
      extractEquip(rawEquip) || extractEquip(rawLabel) || rawEquip || "BLZ INO 200";

    const participantes: any[] = fd?.participantes || [];
    const estadosArr: string[] = Array.from(
      new Set(
        participantes
          .map((p) => p.estado || p.uf || p.state)
          .filter((s) => !!s && typeof s === "string"),
      ),
    );
    const estadosStr = estadosArr.join(", ");
    const total = participantes.length;

    const now = new Date();
    const mesAno = `${MESES[now.getMonth()]} ${now.getFullYear()}`;

    const mediaUploaded: any = run.media_uploaded ?? {};
    const fotoGrupo: string = mediaUploaded?.foto_grupo || "";

    // 3. Assets
    const { data: assets, error: assetsErr } = await supabase
      .from("training_factory_assets")
      .select("*")
      .eq("run_id", run_id);
    if (assetsErr) throw new Error(`assets fetch: ${assetsErr.message}`);

    const basePath = `training/${turmaNumber}/rendered`;
    const results: Array<{ asset_id: string; url: string; type: string }> = [];

    for (const asset of assets ?? []) {
      try {
        let html = "";
        let width = 1080;
        let height = 1080;
        let storagePath = "";

        if (asset.asset_type === "feed_instagram") {
          html = feedHtml({ fotoGrupo, turmaNumber, equipamento, mesAno });
          width = 1080; height = 1080;
          storagePath = `${basePath}/feed_instagram.png`;
        } else if (asset.asset_type === "linkedin") {
          html = linkedinHtml({
            fotoTurma: fotoGrupo,
            turmaNumber,
            cursoNome,
            equipamento,
            total,
            estados: estadosStr,
          });
          width = 1920; height = 1080;
          storagePath = `${basePath}/linkedin.png`;
        } else if (asset.asset_type === "depoimento") {
          const part = participantes.find(
            (p) => p.enrollment_id === asset.enrollment_id ||
                   p.nome === asset.participant_name,
          ) || {};
          const transcricaoCurta = firstWords(asset.transcription || "", 80);
          html = depoimentoHtml({
            videoThumb: fotoGrupo,
            transcricaoCurta,
            cursoNome,
            nome: asset.participant_name || part.nome || "",
            especialidade: part.especialidade || part.especialidade_nome || "Dentista",
            cidade: part.cidade || part.city || "",
            estado: part.estado || part.uf || "",
          });
          width = 1080; height = 1920;
          storagePath = `${basePath}/depoimento_${asset.enrollment_id || asset.id}.png`;
        } else {
          continue;
        }

        const png = await renderViaVercel(VERCEL_URL, html, width, height);

        const { error: upErr } = await supabase.storage
          .from("wa-media")
          .upload(storagePath, png, {
            contentType: "image/png",
            upsert: true,
          });
        if (upErr) throw new Error(`upload ${storagePath}: ${upErr.message}`);

        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/wa-media/${storagePath}`;

        await supabase
          .from("training_factory_assets")
          .update({ media_url: publicUrl, updated_at: new Date().toISOString() })
          .eq("id", asset.id);

        results.push({ asset_id: asset.id, url: publicUrl, type: asset.asset_type });
      } catch (assetErr: any) {
        console.error(`asset ${asset.id} (${asset.asset_type}) failed:`, assetErr);
        results.push({
          asset_id: asset.id,
          url: `ERROR: ${assetErr?.message || assetErr}`,
          type: asset.asset_type,
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, run_id, rendered: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("training-factory-render error", err);
    return new Response(
      JSON.stringify({ error: String(err?.message || err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});