// Edge function: smartops-gerar-doc-turma
// Generates a .docx "Relação de Participantes" for a turma using a FIXED
// 12-column grid so rows with 3+ logical cells (Nota Fiscal/Cidade/UF,
// Acompanhantes) never overflow the page margins.
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  TableLayoutType, PageOrientation,
} from "npm:docx@8.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Page = US Letter (12240 x 15840 DXA) with 1" margins → content = 9360 DXA
const TABLE_WIDTH = 9360;
const COLS = 12;
const COL = TABLE_WIDTH / COLS; // 780 DXA per slot

const NAVY = "1F4E79";
const LABEL_BG = "D5E8F0";
const ROW_ALT_BG = "F4F8FB";
const BORDER_COLOR = "B7CDDB";
const HEADER_TXT = "FFFFFF";

const thin = { style: BorderStyle.SINGLE, size: 4, color: BORDER_COLOR };
const cellBorders = { top: thin, bottom: thin, left: thin, right: thin };
const cellMargins = { top: 80, bottom: 80, left: 140, right: 140 };

function txt(s: string, opts: Partial<{ bold: boolean; color: string; size: number; italics: boolean }> = {}) {
  return new TextRun({ text: s, bold: opts.bold, color: opts.color, size: opts.size, italics: opts.italics });
}
function p(children: any[], opts: Partial<{ spacing: any; alignment: any }> = {}) {
  return new Paragraph({ children, spacing: opts.spacing, alignment: opts.alignment });
}
function blank() { return new Paragraph({ children: [new TextRun("")] }); }

function cell({
  span, children, shading, vAlign,
}: { span: number; children: any[]; shading?: string; vAlign?: "top" | "center" }) {
  return new TableCell({
    width: { size: COL * span, type: WidthType.DXA },
    columnSpan: span,
    borders: cellBorders,
    margins: cellMargins,
    shading: shading ? { fill: shading, type: ShadingType.CLEAR, color: "auto" } : undefined,
    children: children.length ? children : [blank()],
  });
}

function labelCell(label: string, sub?: string) {
  const children: any[] = [p([txt(label, { bold: true, size: 20 })])];
  if (sub) children.push(p([txt(sub, { italics: true, size: 16, color: "666666" })]));
  return cell({ span: 3, children, shading: LABEL_BG });
}

function valueCell(span: number, text: string, opts: Partial<{ bold: boolean; mono: boolean }> = {}) {
  return cell({
    span,
    children: [p([txt(text || "—", { size: 20, bold: opts.bold })])],
  });
}

function multiLineCell(span: number, lines: string[], shading?: string) {
  const children = lines.length
    ? lines.map((l) => p([txt(l, { size: 20 })]))
    : [blank()];
  return cell({ span, children, shading });
}

function kvPairCell(span: number, label: string, value: string) {
  return cell({
    span,
    children: [p([txt(`${label} `, { bold: true, size: 20 }), txt(value || "—", { size: 20 })])],
  });
}

function headerRow(title: string) {
  return new TableRow({
    children: [
      new TableCell({
        width: { size: TABLE_WIDTH, type: WidthType.DXA },
        columnSpan: COLS,
        borders: cellBorders,
        margins: { top: 120, bottom: 120, left: 160, right: 160 },
        shading: { fill: NAVY, type: ShadingType.CLEAR, color: "auto" },
        children: [p([txt(title, { bold: true, color: HEADER_TXT, size: 22 })])],
      }),
    ],
  });
}

function fmtCpfCnpj(v?: string | null): string {
  if (!v) return "—";
  const d = String(v).replace(/\D/g, "");
  if (d.length === 11) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
  return v;
}
function fmtPhone(v?: string | null): string {
  if (!v) return "";
  const d = String(v).replace(/\D/g, "");
  if (d.length === 13 && d.startsWith("55")) {
    const a = d.slice(2,4), b = d.slice(4, d.length - 4), c = d.slice(-4);
    return `(${a}) ${b}-${c}`;
  }
  if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return v;
}

function classifyItems(equipmentData: any, proposalItems: any[]): { equipamentos: { name: string; serial?: string }[]; insumos: string[] } {
  const equipamentos: { name: string; serial?: string }[] = [];
  const insumoLines: string[] = [];

  // Equipamentos = equipment_data entries (carry serial)
  const equipSeen = new Set<string>();
  if (equipmentData && typeof equipmentData === "object") {
    for (const [k, v] of Object.entries<any>(equipmentData)) {
      if (!v || typeof v !== "object") continue;
      const name = String(v.item_nome || "").trim();
      if (!name) continue;
      equipamentos.push({ name, serial: v.serial ? String(v.serial).trim() : undefined });
      equipSeen.add(name.toLowerCase());
    }
  }

  // Insumos = remaining items from proposal snapshot (skip equipamentos and services)
  const skipRe = /^(imers[ãa]o|treinamento|frete|servi[çc]o|desconto)/i;
  if (Array.isArray(proposalItems)) {
    for (const it of proposalItems) {
      const name = String(it?.nome || "").trim();
      if (!name) continue;
      if (equipSeen.has(name.toLowerCase())) continue;
      if (skipRe.test(name)) continue;
      const qtd = Number(it?.qtd ?? it?.quantity ?? 1) || 1;
      insumoLines.push(`[ ${qtd} ] ${name}`);
    }
  }

  return { equipamentos, insumos: insumoLines };
}

function buildParticipantTable(idx: number, e: any): { header: any; table: any } {
  const personName = String(e.person_name || "").trim() || "Sem nome";
  const crmId = e.person_piperun_id || e.lead_piperun_id || "—";
  const erpId = e.empresa_omie_id || e.lead_omie_id || "—";
  const contrato = e.numero_contrato || "—";
  const nf = e.numero_nf || "—";
  const cidade = e.empresa_cidade || e.lead_cidade || "—";
  const uf = e.empresa_estado || e.lead_uf || "—";
  const responsavel = e.responsavel_venda || e.lead_proprietario || "—";
  const cpfCnpj = fmtCpfCnpj(e.empresa_cnpj || e.lead_cpf || "");
  const tel = fmtPhone(e.lead_phone || e.empresa_telefone || "");

  const { equipamentos, insumos } = classifyItems(e.equipment_data, e.proposal_items_snapshot || []);

  const equipLines = equipamentos.length
    ? equipamentos.map((eq) =>
        eq.serial ? `[ 1 ]  ${eq.name}      S/N: ${eq.serial}` : `[ 1 ]  ${eq.name}`,
      )
    : ["—"];

  // Acompanhantes: up to 3 slots, each = 4 cols (Nome / E-mail / Tel stacked)
  const comps = (e.companions || []) as any[];
  const slots = [0, 1, 2].map((i) => comps[i]);

  const header = headerRow(`${idx}. ${personName}   |   CRM ID: ${crmId}   |   ERP ID: ${erpId}`);

  const rows: TableRow[] = [
    header,
    new TableRow({ children: [
      labelCell("Contrato (ID)"),
      valueCell(9, contrato, { bold: true }),
    ]}),
    new TableRow({ children: [
      labelCell("Nome:"),
      valueCell(6, personName),
      kvPairCell(3, "Tel:", tel),
    ]}),
    new TableRow({ children: [
      labelCell("Nota Fiscal"),
      valueCell(3, nf),
      kvPairCell(4, "Cidade:", cidade),
      kvPairCell(2, "UF:", uf),
    ]}),
    new TableRow({ children: [
      labelCell("Responsável venda"),
      valueCell(9, responsavel),
    ]}),
    new TableRow({ children: [
      labelCell("CPF / CNPJ"),
      valueCell(9, cpfCnpj),
    ]}),
    new TableRow({ children: [
      labelCell("Equipamentos", "[RETIRAR NO TREINAMENTO]"),
      multiLineCell(9, equipLines),
    ]}),
    new TableRow({ children: [
      labelCell("Insumos / Kits", "[RETIRAR NO TREINAMENTO]"),
      multiLineCell(9, insumos.length ? insumos : ["—"]),
    ]}),
    new TableRow({ children: [
      labelCell("Acompanhantes:"),
      ...slots.map((c, i) => {
        const num = String(i + 1).padStart(2, "0");
        const lines = [
          `${num} - ${c?.name || "Nome"}`,
          `E-mail: ${c?.email || ""}`,
          `Tel: ${fmtPhone(c?.phone) || ""}`,
        ];
        return multiLineCell(3, lines);
      }),
    ]}),
    new TableRow({ children: [
      labelCell("Observações:"),
      valueCell(9, e.notes || ""),
    ]}),
  ];

  const table = new Table({
    width: { size: TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: Array(COLS).fill(COL),
    layout: TableLayoutType.FIXED,
    borders: {
      top: thin, bottom: thin, left: thin, right: thin,
      insideHorizontal: thin, insideVertical: thin,
    },
    rows,
  });

  return { header, table };
}

async function fetchData(supabase: any, turmaId: string) {
  const { data: turma, error: tErr } = await supabase
    .from("smartops_course_turmas")
    .select("id, label, course_id")
    .eq("id", turmaId)
    .maybeSingle();
  if (tErr) throw tErr;
  if (!turma) throw new Error("Turma não encontrada");

  const { data: course } = await supabase
    .from("smartops_courses")
    .select("id, title")
    .eq("id", turma.course_id)
    .maybeSingle();

  const { data: enrollments, error: eErr } = await supabase
    .from("smartops_course_enrollments")
    .select("*")
    .eq("turma_id", turmaId)
    .not("status", "in", "(cancelled,deleted)")
    .order("person_name", { ascending: true });
  if (eErr) throw eErr;

  const enrollmentIds = (enrollments || []).map((e: any) => e.id);
  let companionsByEnrollment: Record<string, any[]> = {};
  if (enrollmentIds.length) {
    const { data: comps } = await supabase
      .from("smartops_enrollment_companions")
      .select("id, enrollment_id, name, email, phone")
      .in("enrollment_id", enrollmentIds);
    for (const c of comps || []) {
      (companionsByEnrollment[c.enrollment_id] ||= []).push(c);
    }
  }

  // Enrich with lead data (phone, owner, UF, CPF)
  const leadIds = Array.from(new Set((enrollments || []).map((e: any) => e.lead_id).filter(Boolean)));
  let leadById: Record<string, any> = {};
  if (leadIds.length) {
    const { data: leads } = await supabase
      .from("lia_attendances")
      .select("id, telefone_normalized, telefone_raw, proprietario_lead_crm, empresa_uf, uf, pessoa_cpf, empresa_cnpj, empresa_cidade")
      .in("id", leadIds);
    for (const l of leads || []) leadById[l.id] = l;
  }

  const enriched = (enrollments || []).map((e: any) => {
    const l = e.lead_id ? leadById[e.lead_id] : null;
    return {
      ...e,
      companions: companionsByEnrollment[e.id] || [],
      lead_phone: l?.telefone_normalized || l?.telefone_raw || "",
      lead_proprietario: l?.proprietario_lead_crm || "",
      lead_uf: l?.empresa_uf || l?.uf || "",
      lead_cpf: l?.pessoa_cpf || "",
    };
  });

  return { turma, course, enrollments: enriched };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const turmaId = url.searchParams.get("turma_id");
    if (!turmaId) {
      return new Response(JSON.stringify({ error: "turma_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { turma, course, enrollments } = await fetchData(supabase, turmaId);

    const docTitle = `${course?.title || "Curso"} — ${turma.label || ""}`.trim();

    const children: any[] = [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.HEADING_1,
        children: [txt(docTitle, { bold: true, color: NAVY, size: 32 })],
        spacing: { after: 80 },
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [txt("Relação de Participantes — Equipamentos, Números de Série e Insumos", { italics: true, color: "555555", size: 22 })],
        border: { bottom: { color: NAVY, space: 6, style: BorderStyle.SINGLE, size: 12 } },
        spacing: { after: 240 },
      }),
    ];

    if (!enrollments.length) {
      children.push(p([txt("Nenhum participante inscrito nesta turma.", { italics: true, color: "888888" })]));
    } else {
      enrollments.forEach((e: any, i: number) => {
        const { table } = buildParticipantTable(i + 1, e);
        children.push(table);
        children.push(blank()); // spacer between tables
      });
    }

    const doc = new Document({
      creator: "Smart Dent | Fluxo Digital",
      title: docTitle,
      styles: {
        default: { document: { run: { font: "Arial", size: 20 } } },
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children,
      }],
    });

    const buffer = await Packer.toBuffer(doc);
    const safeName = (turma.label || turmaId).replace(/[^a-zA-Z0-9]/g, "_");
    return new Response(buffer, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="imersao_${safeName}.docx"`,
      },
    });
  } catch (err: any) {
    console.error("[smartops-gerar-doc-turma]", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});