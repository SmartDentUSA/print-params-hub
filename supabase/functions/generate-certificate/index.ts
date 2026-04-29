// ============================================================================
// Edge Function: generate-certificate
// Sistema B (okeogjgqijbfkudfjadz)
//
// Gera certificados PDF automaticamente a partir de uma turma confirmada.
// Estratégia: carrega template.pdf (Canva, sem campos preenchidos), sobrescreve
// nome/curso/local/datas via pdf-lib usando fontes Italianno + Alef.
//
// INPUT (POST JSON):
//   {
//     turma_id: uuid,                       // obrigatório
//     enrollment_ids?: uuid[],              // opcional, default = todos enrollments confirmados
//     include_companions?: boolean,         // default true
//     regenerate?: boolean                  // default false (skip se já gerado)
//   }
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PDFDocument, rgb } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const BUCKET = "training-certificates";
const ASSETS_PATH = "_assets";
const TEMPLATE_FILE = "template.pdf";
const ITALIANNO_FILE = "Italianno-Regular.ttf";
const ALEF_FILE = "Alef-Regular.ttf";

const PAGE_W = 842.25;
const PAGE_H = 595.5;

const CONTENT_CENTER_X = 493;
const MAX_NAME_WIDTH = 600;

const NAME_BASELINE_Y = PAGE_H - 237.7 - 55;
const LINE1_BASELINE_Y = PAGE_H - 332.7;
const LINE2_BASELINE_Y = PAGE_H - 353.7;

const NAME_BASE_SIZE = 80;
const NAME_MIN_SIZE = 44;
const TEXT_SIZE = 15;

let cachedTemplate: Uint8Array | null = null;
let cachedItalianno: Uint8Array | null = null;
let cachedAlef: Uint8Array | null = null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} de ${MESES[m - 1]} de ${y}`;
}

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === last) return formatDateBR(first);
  return `${formatDateBR(first)} a ${formatDateBR(last)}`;
}

async function loadAsset(supabase: any, file: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(`${ASSETS_PATH}/${file}`);
  if (error) throw new Error(`Falha ao baixar ${file}: ${error.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

async function generateCertificatePdf(opts: {
  templateBytes: Uint8Array;
  italiannoBytes: Uint8Array;
  alefBytes: Uint8Array;
  studentName: string;
  courseTitle: string;
  location: string;
  dateText: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(opts.templateBytes);
  pdfDoc.registerFontkit(fontkit);

  const italianno = await pdfDoc.embedFont(opts.italiannoBytes);
  const alef = await pdfDoc.embedFont(opts.alefBytes);

  const page = pdfDoc.getPage(0);
  const black = rgb(0, 0, 0);

  let nameSize = NAME_BASE_SIZE;
  while (nameSize > NAME_MIN_SIZE) {
    const w = italianno.widthOfTextAtSize(opts.studentName, nameSize);
    if (w <= MAX_NAME_WIDTH) break;
    nameSize -= 2;
  }
  const nameWidth = italianno.widthOfTextAtSize(opts.studentName, nameSize);
  const nameX = CONTENT_CENTER_X - nameWidth / 2;

  page.drawText(opts.studentName, {
    x: nameX,
    y: NAME_BASELINE_Y,
    size: nameSize,
    font: italianno,
    color: black,
  });

  const line1 = `concluiu com êxito o treinamento de ${opts.courseTitle}`;
  const line1Width = alef.widthOfTextAtSize(line1, TEXT_SIZE);
  page.drawText(line1, {
    x: CONTENT_CENTER_X - line1Width / 2,
    y: LINE1_BASELINE_Y,
    size: TEXT_SIZE,
    font: alef,
    color: black,
  });

  const line2 = `em ${opts.location}, realizado de ${opts.dateText}.`;
  const line2Width = alef.widthOfTextAtSize(line2, TEXT_SIZE);
  page.drawText(line2, {
    x: CONTENT_CENTER_X - line2Width / 2,
    y: LINE2_BASELINE_Y,
    size: TEXT_SIZE,
    font: alef,
    color: black,
  });

  return await pdfDoc.save();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Use POST" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const body = await req.json();
    const turmaId: string = body.turma_id;
    const enrollmentIds: string[] | undefined = body.enrollment_ids;
    const includeCompanions: boolean = body.include_companions ?? true;
    const regenerate: boolean = body.regenerate ?? false;

    if (!turmaId) {
      return new Response(
        JSON.stringify({ error: "turma_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: turma, error: turmaErr } = await supabase
      .from("smartops_course_turmas")
      .select(`
        id, label, course_id,
        course:smartops_courses!course_id (
          id, title, location, instructor_name
        )
      `)
      .eq("id", turmaId)
      .single();

    if (turmaErr || !turma) {
      return new Response(
        JSON.stringify({ error: `Turma não encontrada: ${turmaErr?.message}` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const course = (turma as any).course;
    const courseTitle = course?.title || "Treinamento";
    const location = course?.location || "Smart Dent";

    const { data: days } = await supabase
      .from("smartops_turma_days")
      .select("date")
      .eq("turma_id", turmaId)
      .order("date", { ascending: true });

    const dateList = (days || []).map((d: any) => d.date);
    if (dateList.length === 0) {
      return new Response(
        JSON.stringify({ error: "Turma não tem dias cadastrados em smartops_turma_days" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const dateText = formatDateRange(dateList);

    let enrollQuery = supabase
      .from("smartops_course_enrollments")
      .select("id, person_name, status, certificate_pdf_path")
      .eq("turma_id", turmaId);

    if (enrollmentIds && enrollmentIds.length > 0) {
      enrollQuery = enrollQuery.in("id", enrollmentIds);
    } else {
      enrollQuery = enrollQuery.in("status", ["confirmed", "validated", "completed"]);
    }

    const { data: enrollments, error: enrErr } = await enrollQuery;
    if (enrErr) throw new Error(`Falha buscando enrollments: ${enrErr.message}`);
    if (!enrollments || enrollments.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhum participante elegível encontrado nesta turma" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let companions: any[] = [];
    if (includeCompanions) {
      const enrollIds = enrollments.map((e: any) => e.id);
      const { data: comps } = await supabase
        .from("smartops_enrollment_companions")
        .select("id, enrollment_id, name, certificate_pdf_path")
        .in("enrollment_id", enrollIds);
      companions = comps || [];
    }

    if (!cachedTemplate) cachedTemplate = await loadAsset(supabase, TEMPLATE_FILE);
    if (!cachedItalianno) cachedItalianno = await loadAsset(supabase, ITALIANNO_FILE);
    if (!cachedAlef) cachedAlef = await loadAsset(supabase, ALEF_FILE);

    const results: any[] = [];
    const errors: any[] = [];

    type Person = { type: "enrollment" | "companion"; id: string; name: string; existing_path?: string | null };
    const people: Person[] = [
      ...enrollments.map((e: any) => ({
        type: "enrollment" as const,
        id: e.id,
        name: e.person_name || "Participante",
        existing_path: e.certificate_pdf_path,
      })),
      ...companions.map((c: any) => ({
        type: "companion" as const,
        id: c.id,
        name: c.name,
        existing_path: c.certificate_pdf_path,
      })),
    ];

    for (const person of people) {
      try {
        if (person.existing_path && !regenerate) {
          const { data: signed } = await supabase.storage
            .from(BUCKET)
            .createSignedUrl(person.existing_path, 60 * 60 * 24 * 30);
          results.push({
            type: person.type,
            id: person.id,
            person_name: person.name,
            pdf_path: person.existing_path,
            signed_url: signed?.signedUrl,
            status: "skipped_already_exists",
          });
          continue;
        }

        const pdfBytes = await generateCertificatePdf({
          templateBytes: cachedTemplate!,
          italiannoBytes: cachedItalianno!,
          alefBytes: cachedAlef!,
          studentName: person.name,
          courseTitle,
          location,
          dateText,
        });

        const path = `generated/${turmaId}/${person.type}_${person.id}.pdf`;
        const { error: upErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });
        if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

        const tableName = person.type === "enrollment"
          ? "smartops_course_enrollments"
          : "smartops_enrollment_companions";
        await supabase
          .from(tableName)
          .update({
            certificate_pdf_path: path,
            certificate_generated_at: new Date().toISOString(),
          })
          .eq("id", person.id);

        const { data: signed } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(path, 60 * 60 * 24 * 30);

        results.push({
          type: person.type,
          id: person.id,
          person_name: person.name,
          pdf_path: path,
          signed_url: signed?.signedUrl,
          status: "generated",
        });
      } catch (e) {
        errors.push({
          type: person.type,
          id: person.id,
          person_name: person.name,
          error: (e as Error).message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        turma: {
          id: turma.id,
          label: turma.label,
          course_title: courseTitle,
          location,
          date_text: dateText,
        },
        certificates: results,
        errors,
        summary: {
          total: people.length,
          generated: results.filter((r) => r.status === "generated").length,
          skipped: results.filter((r) => r.status === "skipped_already_exists").length,
          failed: errors.length,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[generate-certificate] erro:", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});