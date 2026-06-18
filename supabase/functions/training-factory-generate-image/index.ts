import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import { callPoe } from "../_shared/providers/poe.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({
  run_id: z.string().uuid(),
  asset_type: z.enum(["feed_instagram", "linkedin", "depoimento"]),
  foto_grupo_url: z.string().url().optional().default(""),
});

const MESES = [
  "JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
  "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO",
];

function mesAno(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`;
}

function buildPrompt(
  assetType: "feed_instagram" | "linkedin" | "depoimento",
  ctx: {
    turma_number: string | number;
    curso_nome: string;
    equipamento: string;
    mes_ano: string;
    total_participantes: number;
    estados: string[];
    participante_nome?: string;
    especialidade?: string;
    cidade?: string;
    estado?: string;
    depoimento?: string;
  },
): string {
  if (assetType === "feed_instagram") {
    return `Crie uma imagem vertical 1080x1350px para Instagram com estética premium corporativa.
Fundo escuro predominante (#0A0F1E).
Elementos:
- Logo Smart Dent no topo esquerdo (branco)
- Badge laranja (#E8821A) com "TURMA #${ctx.turma_number}"
- Título grande branco "ODONTOLOGIA DIGITAL"
- Subtítulo "CHAIRSIDE PRINT"
- Equipamento: "${ctx.equipamento}"
- Local e data: "São Carlos – SP | ${ctx.mes_ano}"
- Rodapé: ícones de certificação, conhecimento, casos reais
- ${ctx.total_participantes} profissionais de ${ctx.estados.join(", ")}
Estética: editorial premium, tecnológico, sem aparência de flyer.
Tipografia moderna sem serifa. Alto contraste. Espaço respirado.
NÃO incluir faces ou pessoas. Elementos geométricos e arquitetônicos.`;
  }
  if (assetType === "linkedin") {
    return `Crie uma imagem horizontal 1920x1080px estilo LinkedIn corporativo premium.
Fundo escuro predominante.
Lado esquerdo: texto. Lado direito: elemento visual tecnológico/arquitetônico.
Elementos:
- Logo Smart Dent topo esquerdo
- "TURMA #${ctx.turma_number} CONCLUÍDA" — subtítulo caps
- "${ctx.curso_nome}" — título grande branco negrito
- "${ctx.equipamento} · ${ctx.total_participantes} profissionais · ${ctx.estados.join(", ")}"
Estética: corporativo internacional, premium, sem excesso de ícones.`;
  }
  return `Crie uma imagem vertical 1080x1920px para Instagram/TikTok estilo depoimento premium.
Overlay roxo escuro semitransparente (rgba 30,20,80,0.8) sobre fundo abstrato tecnológico.
Elementos:
- Logo Smart Dent branco topo esquerdo
- Aspas grandes laranja (#E8821A) no centro
- Texto de depoimento em branco${ctx.depoimento ? `: "${ctx.depoimento}"` : ""}
- Nome: "${ctx.participante_nome ?? ""}"
- Especialidade: "${ctx.especialidade ?? ""}"
- Cidade: "${ctx.cidade ?? ""}/${ctx.estado ?? ""}"
- Rodapé: "TREINAMENTO CHAIRSIDE PRINT"
Estética: premium, emocional, tecnológico.`;
}

function extractImageUrl(text: string): string | null {
  if (!text) return null;
  // markdown ![](url)
  const md = text.match(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/);
  if (md) return md[1];
  // bare URL ending with image extension
  const bare = text.match(/(https?:\/\/[^\s)"']+\.(?:png|jpg|jpeg|webp)(?:\?[^\s)"']*)?)/i);
  if (bare) return bare[1];
  // any http url
  const any = text.match(/(https?:\/\/[^\s)"']+)/);
  return any ? any[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { run_id, asset_type, foto_grupo_url } = parsed.data;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // 1. run
    const { data: run, error: runErr } = await supabase
      .from("training_factory_runs")
      .select("*")
      .eq("id", run_id)
      .maybeSingle();
    if (runErr || !run) {
      return new Response(JSON.stringify({ error: "run não encontrada", details: runErr?.message }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. turma data
    const turmaId = (run as any).turma_id;
    const { data: turmaData, error: turmaErr } = await supabase.rpc("fn_get_turma_factory_data", { p_turma_id: turmaId });
    if (turmaErr) {
      return new Response(JSON.stringify({ error: "fn_get_turma_factory_data falhou", details: turmaErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const turma: any = Array.isArray(turmaData) ? turmaData[0] : turmaData;

    // 3. asset
    const { data: asset } = await supabase
      .from("training_factory_assets")
      .select("*")
      .eq("run_id", run_id)
      .eq("asset_type", asset_type)
      .maybeSingle();

    // 4. prompt
    const participantes: any[] = turma?.participantes ?? turma?.enrollments ?? [];
    const estados = Array.from(new Set(participantes.map((p) => p.estado || p.uf).filter(Boolean))) as string[];
    const ctx = {
      turma_number: turma?.turma_number ?? turma?.numero ?? "",
      curso_nome: turma?.curso_nome ?? turma?.course_name ?? "",
      equipamento: turma?.equipamento ?? turma?.equipment ?? "",
      mes_ano: mesAno(turma?.data_inicio ?? turma?.start_date),
      total_participantes: participantes.length,
      estados,
      participante_nome: asset?.participante_nome ?? participantes[0]?.nome ?? "",
      especialidade: asset?.especialidade ?? participantes[0]?.especialidade ?? "",
      cidade: asset?.cidade ?? participantes[0]?.cidade ?? "",
      estado: asset?.estado ?? participantes[0]?.estado ?? "",
      depoimento: asset?.transcription ?? "",
    };
    const prompt = buildPrompt(asset_type, ctx);
    console.log(`[generate-image] ${asset_type} run=${run_id} prompt_len=${prompt.length}`);
    if (foto_grupo_url) console.log(`[generate-image] foto_grupo_url=${foto_grupo_url}`);

    // 5. Poe image gen
    const poeRes = await callPoe({
      model: "Nano-Banana",
      messages: [{ role: "user", content: prompt }],
    });
    if (!poeRes.ok) {
      return new Response(JSON.stringify({ error: "Poe falhou", details: poeRes.error }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const imageUrl = extractImageUrl(poeRes.text ?? "");
    if (!imageUrl) {
      return new Response(JSON.stringify({ error: "URL de imagem não retornada", raw: poeRes.text?.slice(0, 500) }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. fetch + upload
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
      return new Response(JSON.stringify({ error: "Falha ao baixar imagem gerada", status: imgResp.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const bytes = new Uint8Array(await imgResp.arrayBuffer());
    const contentType = imgResp.headers.get("content-type") || "image/png";
    const ext = contentType.includes("jpeg") ? "jpg" : "png";
    const path = `training/${ctx.turma_number || run_id}/generated/${asset_type}.${ext}`;

    const { error: upErr } = await supabase.storage
      .from("wa-media")
      .upload(path, bytes, { contentType, upsert: true });
    if (upErr) {
      return new Response(JSON.stringify({ error: "Upload falhou", details: upErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: pub } = supabase.storage.from("wa-media").getPublicUrl(path);
    const publicUrl = pub.publicUrl;

    // 7. update asset
    if (asset?.id) {
      await supabase
        .from("training_factory_assets")
        .update({ media_url: publicUrl, updated_at: new Date().toISOString() })
        .eq("id", asset.id);
    } else {
      await supabase
        .from("training_factory_assets")
        .insert({ run_id, asset_type, media_url: publicUrl });
    }

    return new Response(
      JSON.stringify({ ok: true, media_url: publicUrl, prompt_used: prompt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[generate-image] erro:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});