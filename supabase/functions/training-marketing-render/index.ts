// training-marketing-render
// Renderiza artes de marketing de treinamento NO SERVIDOR usando:
//  1. a fotografia real da turma no Google Drive oficial (pixels originais);
//  2. o arquivo original do logo Smart Dent;
//  3. textos/parâmetros recebidos na requisição.
// A fotografia e o logo NUNCA são regenerados por IA — nenhum modelo de imagem
// é chamado aqui. Só crop/escala, ajuste global leve e composição gráfica.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import {
  getDriveAccessToken,
  driveDownloadFile,
  driveUploadFile,
  driveListNames,
  driveGetWebViewLink,
} from "../_shared/drive.ts";
import { authorizeMedia, buildAccessUrls } from "../_shared/training-media-access.ts";
import { FORMATS, buildSvg, type RenderFormat } from "./layouts.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AGENT_KEY = Deno.env.get("SMARTOPS_MARKETING_AGENT_API_KEY") || "";
const WASM_URL = "https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm";

const TURMA_SELECT =
  "id, turma_number, label, active, start_date, end_date, factory_status, drive_folder_id, drive_subfolders, " +
  "smartops_courses(title, slug)";

const BodySchema = z.object({
  turma_number: z.coerce.number().int().positive(),
  drive_file_id: z.string().min(10).max(200),
  format: z.enum([
    "instagram_feed_vertical",
    "instagram_feed_square",
    "instagram_story",
    "instagram_reel_cover",
  ]),
  title: z.string().min(1).max(160),
  subtitle: z.string().min(1).max(220),
  cta: z.string().min(1).max(60),
  focus: z.enum(["top", "center", "bottom"]).optional(),
  brightness: z.coerce.number().min(0.9).max(1.1).optional(),
  saturation: z.coerce.number().min(0.9).max(1.1).optional(),
  dry_run: z.boolean().optional(),
});

const PHOTO_MIMES = new Set(["image/jpeg", "image/pjpeg", "image/png", "image/webp"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function b64(bytes: Uint8Array): string {
  let out = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(out);
}

function asset(name: string): Promise<Uint8Array> {
  return Deno.readFile(new URL(`./assets/${name}`, import.meta.url));
}

function upperSnake(input: string): string {
  return String(input || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "TREINAMENTO";
}

function nextSequence(prefix: string, existing: string[]): number {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_(\\d{3,})\\.`, "i");
  let max = 0;
  for (const n of existing) {
    const m = n.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

let wasmReady: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  if (!wasmReady) wasmReady = initWasm(fetch(WASM_URL));
  return wasmReady;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  // ---- auth: mesma chave da API de leitura do agente (server-side only) ----
  const auth = req.headers.get("Authorization") || "";
  const provided = auth.replace(/^Bearer\s+/i, "").trim() || req.headers.get("x-api-key") || "";
  const ok = (!!AGENT_KEY && provided === AGENT_KEY) || (!!SERVICE_ROLE && provided === SERVICE_ROLE);
  if (!ok) return json({ error: "UNAUTHORIZED", message: "Chave de API inválida" }, 401);

  try {
    const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "VALIDATION_ERROR", details: parsed.error.flatten().fieldErrors }, 400);
    const p = parsed.data;
    const format = p.format as RenderFormat;
    const spec = FORMATS[format];

    const db = createClient(SUPABASE_URL, SERVICE_ROLE);

    // ---- 1. turma pelo número ----
    const { data: turmas, error: tErr } = await db
      .from("smartops_course_turmas")
      .select(TURMA_SELECT)
      .eq("turma_number", p.turma_number)
      .order("start_date", { ascending: false, nullsFirst: false })
      .limit(1);
    if (tErr) return json({ error: "DB_ERROR", message: tErr.message }, 500);
    const turma: any = (turmas || [])[0];
    if (!turma) return json({ error: "TRAINING_NOT_FOUND", message: `Turma #${p.turma_number} não encontrada` }, 404);

    // ---- 2. turma ativa ----
    const cancelled = /cancel/i.test(`${turma.label || ""} ${turma.factory_status || ""}`);
    if (turma.active === false || cancelled) {
      return json({ error: "TRAINING_NOT_ELIGIBLE", message: "Turma inativa ou cancelada" }, 409);
    }
    if (!turma.drive_folder_id) {
      return json({ error: "TRAINING_DRIVE_NOT_CONFIGURED", message: "Turma sem estrutura oficial no Google Drive" }, 409);
    }

    // ---- 3. o drive_file_id pertence à turma? (infra existente) ----
    const authz = await authorizeMedia(db, turma, p.drive_file_id);
    if (!authz.ok) {
      const status = authz.error === "MEDIA_NOT_FOUND" ? 404 : authz.error === "MEDIA_NOT_IN_TRAINING" ? 403 : 409;
      return json({ error: authz.error, message: authz.message }, status);
    }
    const media = authz.media;
    if (media.kind !== "photo") {
      return json({ error: "MEDIA_NOT_A_PHOTO", message: "O arquivo informado não é uma fotografia" }, 422);
    }
    const srcMime = String(media.mime_type || "").toLowerCase();
    if (!PHOTO_MIMES.has(srcMime)) {
      return json({
        error: "MEDIA_FORMAT_UNSUPPORTED",
        message: `Formato ${srcMime || "desconhecido"} não suportado na composição (use JPEG, PNG ou WebP).`,
      }, 422);
    }

    // ---- pasta oficial de entrega (nunca criar estrutura paralela) ----
    const sub = (turma.drive_subfolders || {}) as Record<string, string>;
    const deliveryKey = spec.deliveryKeys.find((k) => sub[k]);
    if (!deliveryKey) {
      return json({
        error: "DELIVERY_FOLDER_MISSING",
        message:
          `A turma não possui a pasta oficial de entregas para o formato ${format} ` +
          `(esperado uma de: ${spec.deliveryKeys.join(", ")}). ` +
          "Rode training-create-drive-folder para provisionar a estrutura oficial — nenhuma pasta paralela foi criada.",
      }, 409);
    }
    const destFolderId = sub[deliveryKey];

    // ---- 4. arquivo real do Drive (server-side, credenciais nunca expostas) ----
    const token = await getDriveAccessToken();
    const photoBytes = await driveDownloadFile(token, p.drive_file_id);
    const logoBytes = await asset("smartdent-logo.png");

    const courseTitle = turma.smartops_courses?.title || turma.label || "Treinamento";
    const { svg, width, height } = buildSvg({
      format,
      photoDataUri: `data:${srcMime};base64,${b64(photoBytes)}`,
      logoDataUri: `data:image/png;base64,${b64(logoBytes)}`,
      turmaNumber: turma.turma_number,
      courseTitle,
      title: p.title,
      subtitle: p.subtitle,
      cta: p.cta,
      focus: p.focus,
      brightness: p.brightness,
      saturation: p.saturation,
    });

    // ---- render real (PNG) ----
    await ensureWasm();
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: {
        fontBuffers: [await asset("Poppins-Bold.ttf"), await asset("Poppins-Regular.ttf")],
        defaultFontFamily: "Poppins",
        loadSystemFonts: false,
      },
    });
    const png = resvg.render().asPng();

    // ---- nomenclatura oficial + sequência ----
    const prefix = `T${turma.turma_number}_${upperSnake(courseTitle)}_MKT_${spec.token}`;
    const existing = await driveListNames(token, destFolderId, prefix).catch(() => [] as string[]);
    const sequence = nextSequence(prefix, existing);
    const outputFilename = `${prefix}_${String(sequence).padStart(3, "0")}.png`;

    if (p.dry_run) {
      return json({
        success: true,
        status: "dry_run",
        turma_number: turma.turma_number,
        drive_file_id: p.drive_file_id,
        source_filename: media.filename,
        output_filename: outputFilename,
        width,
        height,
        mime_type: "image/png",
        size_bytes: png.length,
        drive_output_folder_key: deliveryKey,
        drive_output_file_id: null,
        preview_url: null,
      });
    }

    // ---- 5. salvar na estrutura oficial da turma ----
    const outId = await driveUploadFile({
      token,
      folderId: destFolderId,
      name: outputFilename,
      content: png,
      mimeType: "image/png",
    });
    const webViewLink = await driveGetWebViewLink(token, outId).catch(() => null);
    // Preview por proxy assinado (TTL curto), sem expor credenciais do Drive.
    const access = await buildAccessUrls(SUPABASE_URL, turma.id, outId, "photo").catch(() => null);

    return json({
      success: true,
      status: "rendered",
      turma_number: turma.turma_number,
      turma_id: turma.id,
      course_title: courseTitle,
      drive_file_id: p.drive_file_id,
      source_filename: media.filename,
      output_filename: outputFilename,
      format,
      width,
      height,
      mime_type: "image/png",
      size_bytes: png.length,
      sequence,
      drive_output_folder_key: deliveryKey,
      drive_output_folder_id: destFolderId,
      drive_output_file_id: outId,
      drive_web_view_link: webViewLink,
      preview_url: access?.preview_url || access?.original_url || null,
      preview_expires_at: access?.expires_at || null,
      photo_regenerated_by_ai: false,
      logo_source: "arquivo oficial embutido na função",
    });
  } catch (e: any) {
    console.error("[training-marketing-render] erro:", e?.message || e);
    return json({ success: false, error: "RENDER_FAILED", message: e?.message || String(e) }, 500);
  }
});