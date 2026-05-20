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
const ASSETS_PATH = "";
const TEMPLATE_FILE = "template.pdf";
const ITALIANNO_FILE = "Italianno-Regular.ttf";
const ALEF_FILE = "Alef-Regular.ttf";

// Dimensões do template novo (842.16 x 595.44 — A4 paisagem do Canva)
const PAGE_W = 842.16;
const PAGE_H = 595.44;

// Centro horizontal alinhado com "Certificado" e "Certificamos que" do template novo
const CONTENT_CENTER_X = 487;

// Largura máxima útil pro nome — lateral de ícones ocupa até x≈225, deixa respiro à direita
const MAX_NAME_WIDTH = 520;

// Baselines verticais (sistema pdf-lib: Y cresce do fundo pro topo)
const NAME_BASELINE_Y = PAGE_H - 305;   // ~290 — nome em script grande
const LINE1_BASELINE_Y = PAGE_H - 370;  // ~225 — "concluiu com êxito o treinamento de..."
const LINE2_BASELINE_Y = PAGE_H - 391;  // ~204 — "em [local], realizado de [datas]."

// Tamanhos de fonte
const NAME_BASE_SIZE = 75;  // tamanho inicial do nome (auto-fit reduz se necessário)
const NAME_MIN_SIZE = 38;   // mínimo antes de aplicar escala forçada
const TEXT_SIZE = 15;       // texto secundário (Alef)
const BODY_LINE_HEIGHT = TEXT_SIZE * 1.35;
const BODY_MAX_WIDTH = 620; // largura útil para o corpo (mais larga que o nome)
const BODY_TOP_Y = PAGE_H - 370; // baseline da primeira linha do corpo

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

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([\wÀ-ÿ_]+)\s*\}\}/gi, (_m, k: string) => {
    const key = k.toLowerCase();
    return vars[key] ?? "";
  });
}

function hoursBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const diff = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
  return diff > 0 ? diff : null;
}

function formatHours(n: number): string {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1).replace(".", ",");
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    if (!paragraph.trim()) { lines.push(""); continue; }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const w of words) {
      const candidate = current ? `${current} ${w}` : w;
      const width = font.widthOfTextAtSize(candidate, size);
      if (width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        current = w;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

async function loadAsset(supabase: any, file: string): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(ASSETS_PATH ? `${ASSETS_PATH}/${file}` : file);
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
  bodyText: string;
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(opts.templateBytes);
  pdfDoc.registerFontkit(fontkit);

  const italianno = await pdfDoc.embedFont(opts.italiannoBytes);
  const alef = await pdfDoc.embedFont(opts.alefBytes);

  const page = pdfDoc.getPage(0);
  const black = rgb(0, 0, 0);

  // Auto-fit do nome: reduz fonte de 2 em 2 pt até caber em MAX_NAME_WIDTH
  let nameSize = NAME_BASE_SIZE;
  while (nameSize > NAME_MIN_SIZE) {
    const w = italianno.widthOfTextAtSize(opts.studentName, nameSize);
    if (w <= MAX_NAME_WIDTH) break;
    nameSize -= 2;
  }

  // Garantia anti-estouro: se mesmo no NAME_MIN_SIZE o nome ainda excede MAX_NAME_WIDTH,
  // aplica escala proporcional pra forçar caber EXATO no limite (nome muito longo
  // vai ficar pequeno, mas legível e dentro das margens).
  let nameWidth = italianno.widthOfTextAtSize(opts.studentName, nameSize);
  if (nameWidth > MAX_NAME_WIDTH) {
    nameSize = (MAX_NAME_WIDTH / nameWidth) * nameSize;
    nameWidth = MAX_NAME_WIDTH;
  }

  const nameX = CONTENT_CENTER_X - nameWidth / 2;

  page.drawText(opts.studentName, {
    x: nameX,
    y: NAME_BASELINE_Y,
    size: nameSize,
    font: italianno,
    color: black,
  });

  // Renderiza o corpo do certificado (template configurável) com word-wrap centralizado
  const lines = wrapText(opts.bodyText, alef, TEXT_SIZE, BODY_MAX_WIDTH);
  let y = BODY_TOP_Y;
  for (const line of lines) {
    if (line) {
      const w = alef.widthOfTextAtSize(line, TEXT_SIZE);
      page.drawText(line, {
        x: CONTENT_CENTER_X - w / 2,
        y,
        size: TEXT_SIZE,
        font: alef,
        color: black,
      });
    }
    y -= BODY_LINE_HEIGHT;
  }

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
          id, title, location, instructor_name, duration_days, duration_hours_per_day, certificate_body_template
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
    const instructor = course?.instructor_name || "";
    const durationDays = Number(course?.duration_days || 1);
    const hoursPerDay = course?.duration_hours_per_day ? Number(course.duration_hours_per_day) : null;
    const bodyTemplate: string = course?.certificate_body_template
      || `concluiu com êxito o treinamento de {{curso}}.\nA imersão ocorreu em {{local}}, no período de {{data_inicio}} a {{data_fim}}, com duração de {{horas_dia}}h/dia em {{dias}} dias, e teve como objetivo o treinamento técnico para operação e utilização das soluções adquiridas.`;

    const { data: days } = await supabase
      .from("smartops_turma_days")
      .select("date, start_time, end_time")
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
    const sortedDates = [...dateList].sort();
    const dataInicio = formatDateBR(sortedDates[0]);
    const dataFim = formatDateBR(sortedDates[sortedDates.length - 1]);
    const periodo = dataInicio === dataFim ? dataInicio : `${dataInicio} a ${dataFim}`;

    // Calcula horas/dia e carga horária a partir dos horários reais dos dias.
    const perDayHours = (days || [])
      .map((d: any) => hoursBetween(d.start_time, d.end_time))
      .filter((h: number | null): h is number => h != null && h > 0);
    let horasDiaStr = "";
    let cargaHorariaStr = "";
    if (perDayHours.length > 0) {
      const totalHours = perDayHours.reduce((a, b) => a + b, 0);
      const avg = totalHours / perDayHours.length;
      horasDiaStr = formatHours(avg);
      cargaHorariaStr = formatHours(totalHours);
    } else if (hoursPerDay != null) {
      horasDiaStr = formatHours(hoursPerDay);
      cargaHorariaStr = formatHours(hoursPerDay * durationDays);
    }

    let enrollQuery = supabase
      .from("smartops_course_enrollments")
      .select("id, person_name, status, certificate_pdf_path, certificate_render_snapshot")
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
        .select("id, enrollment_id, name, certificate_pdf_path, certificate_render_snapshot")
        .in("enrollment_id", enrollIds);
      companions = comps || [];
    }

    if (!cachedTemplate) cachedTemplate = await loadAsset(supabase, TEMPLATE_FILE);
    if (!cachedItalianno) cachedItalianno = await loadAsset(supabase, ITALIANNO_FILE);
    if (!cachedAlef) cachedAlef = await loadAsset(supabase, ALEF_FILE);

    const results: any[] = [];
    const errors: any[] = [];

    type Person = {
      type: "enrollment" | "companion";
      id: string;
      name: string;
      existing_path?: string | null;
      render_snapshot?: any;
    };
    const people: Person[] = [
      ...enrollments.map((e: any) => ({
        type: "enrollment" as const,
        id: e.id,
        name: e.person_name || "Participante",
        existing_path: e.certificate_pdf_path,
        render_snapshot: e.certificate_render_snapshot,
      })),
      ...companions.map((c: any) => ({
        type: "companion" as const,
        id: c.id,
        name: c.name,
        existing_path: c.certificate_pdf_path,
        render_snapshot: c.certificate_render_snapshot,
      })),
    ];

    for (const person of people) {
      try {
        const vars: Record<string, string> = {
          nome: person.name,
          curso: courseTitle,
          local: location,
          data_inicio: dataInicio,
          data_fim: dataFim,
          periodo,
          dias: String(durationDays),
          horas_dia: horasDiaStr,
          carga_horaria: cargaHorariaStr,
          instrutor: instructor,
        };
        const bodyText = renderTemplate(bodyTemplate, vars);

        const currentSnapshot = {
          course_title: courseTitle,
          location,
          date_text: dateText,
          student_name: person.name,
          body_text: bodyText,
        };
        const snap = person.render_snapshot;
        const isStale = !snap
          || snap.course_title !== currentSnapshot.course_title
          || snap.location     !== currentSnapshot.location
          || snap.date_text    !== currentSnapshot.date_text
          || snap.student_name !== currentSnapshot.student_name
          || snap.body_text    !== currentSnapshot.body_text;

        if (person.existing_path && !regenerate && !isStale) {
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
          bodyText,
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
            certificate_render_snapshot: currentSnapshot,
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
          status: person.existing_path && isStale ? "regenerated_stale" : "generated",
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
          regenerated_stale: results.filter((r) => r.status === "regenerated_stale").length,
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