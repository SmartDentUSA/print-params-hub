// Edge function: smartops-gerar-crachas-turma
// Gera PDF de crachás dobráveis para uma turma.
// Formato: A4 retrato, 2 crachás por página. Cada crachá ocupa metade
// da página e é dividido em duas seções (topo invertido 180°, base normal),
// pensado para ser dobrado ao meio formando um crachá de mesa/pescoço com
// frente e verso idênticos.
import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, degrees } from "npm:pdf-lib@1.17.1";
import { TEMPLATE_CRACHA_BASE64 } from "./template-cracha.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// A4 em pontos (1pt = 1/72 inch). 595.28 x 841.89
const A4_W = 595.28;
const A4_H = 841.89;

// Cores Smart Dent (mantidas para os textos sobrepostos ao template)
const TEXT = rgb(0x2b / 255, 0x35 / 255, 0x52 / 255); // navy do logo
const MUTED = rgb(0.35, 0.35, 0.4);

interface Participant {
  nome: string;
  especialidade: string;
  cidade_uf: string;
}

function safe(s?: string | null): string {
  return (s ?? "").toString().trim();
}

async function fetchParticipants(supabase: any, turmaId: string): Promise<{ courseTitle: string; turmaLabel: string; rows: Participant[] }> {
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
    .select("id, person_name, especialidade, area_atuacao, empresa_cidade, empresa_estado, lead_id")
    .eq("turma_id", turmaId)
    .not("status", "in", "(cancelled,deleted)")
    .order("person_name", { ascending: true });
  if (eErr) throw eErr;

  // Enriquecer com lead (UF/cidade) e companions
  const ids = (enrollments || []).map((e: any) => e.id);
  const leadIds = Array.from(new Set((enrollments || []).map((e: any) => e.lead_id).filter(Boolean)));

  let leadById: Record<string, any> = {};
  if (leadIds.length) {
    const { data: leads } = await supabase
      .from("lia_attendances")
      .select("id, empresa_cidade, empresa_uf, uf, especialidade, area_atuacao")
      .in("id", leadIds);
    for (const l of leads || []) leadById[l.id] = l;
  }

  let companionsByEnrollment: Record<string, any[]> = {};
  if (ids.length) {
    const { data: comps } = await supabase
      .from("smartops_enrollment_companions")
      .select("enrollment_id, name, especialidade, area_atuacao")
      .in("enrollment_id", ids);
    for (const c of comps || []) {
      (companionsByEnrollment[c.enrollment_id] ||= []).push(c);
    }
  }

  const rows: Participant[] = [];
  for (const e of enrollments || []) {
    const l = e.lead_id ? leadById[e.lead_id] : null;
    const cidade = safe(e.empresa_cidade || l?.empresa_cidade);
    const uf = safe(e.empresa_estado || l?.empresa_uf || l?.uf);
    const cidade_uf = [cidade, uf].filter(Boolean).join(" / ");
    const esp = safe(e.especialidade || l?.especialidade || e.area_atuacao || l?.area_atuacao);
    rows.push({
      nome: safe(e.person_name) || "Participante",
      especialidade: esp,
      cidade_uf,
    });
    // Acompanhantes ganham crachá próprio (sem cidade/UF se desconhecida)
    for (const c of companionsByEnrollment[e.id] || []) {
      rows.push({
        nome: safe(c.name) || "Acompanhante",
        especialidade: safe(c.especialidade || c.area_atuacao),
        cidade_uf,
      });
    }
  }

  return {
    courseTitle: safe(course?.title) || "Treinamento",
    turmaLabel: safe(turma.label),
    rows,
  };
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

// Desenha o conteúdo de um lado do crachá centrado dentro de (x, y, w, h).
// O template (fundo) já contém logos nas posições corretas; aqui só sobrepomos
// os textos dinâmicos (Nome, Especialidade, Cidade/UF).
function drawSide(page: any, p: Participant, x: number, y: number, w: number, h: number, font: any, fontBold: any, rotate: 0 | 180) {
  const nome = truncate(p.nome, 36).toUpperCase();
  const esp = truncate(p.especialidade || "—", 48);
  const cid = truncate(p.cidade_uf || "—", 40);

  const sizeNome = 24;
  const sizeEsp = 16;
  const sizeCid = 16;

  if (rotate === 0) {
    const cx = x + w / 2;
    // Empilhamento de cima para baixo, centrado verticalmente no meio do lado
    let cy = y + h / 2 + 20;
    const nomeW = fontBold.widthOfTextAtSize(nome, sizeNome);
    page.drawText(nome, { x: cx - nomeW / 2, y: cy, size: sizeNome, font: fontBold, color: TEXT });
    cy -= 32;
    const espW = font.widthOfTextAtSize(esp, sizeEsp);
    page.drawText(esp, { x: cx - espW / 2, y: cy, size: sizeEsp, font, color: MUTED });
    cy -= 22;
    const cidW = font.widthOfTextAtSize(cid, sizeCid);
    page.drawText(cid, { x: cx - cidW / 2, y: cy, size: sizeCid, font, color: MUTED });
  } else {
    const cx = x + w / 2;
    let cy = y + h / 2 - 20;
    const nomeW = fontBold.widthOfTextAtSize(nome, sizeNome);
    page.drawText(nome, { x: cx + nomeW / 2, y: cy, size: sizeNome, font: fontBold, color: TEXT, rotate: degrees(180) });
    cy += 32;
    const espW = font.widthOfTextAtSize(esp, sizeEsp);
    page.drawText(esp, { x: cx + espW / 2, y: cy, size: sizeEsp, font, color: MUTED, rotate: degrees(180) });
    cy += 22;
    const cidW = font.widthOfTextAtSize(cid, sizeCid);
    page.drawText(cid, { x: cx + cidW / 2, y: cy, size: sizeCid, font, color: MUTED, rotate: degrees(180) });
  }
}

// Desenha um crachá foldável dentro de (x, y, w, h). Linha de dobra no meio.
// Topo = rotate 180, Base = rotate 0.
function drawBadge(page: any, p: Participant, x: number, y: number, w: number, h: number, font: any, fontBold: any) {
  const halfH = h / 2;
  // Topo (invertido)
  drawSide(page, p, x, y + halfH, w, halfH, font, fontBold, 180);
  // Base (normal)
  drawSide(page, p, x, y, w, halfH, font, fontBold, 0);
}

async function buildPdf(courseTitle: string, turmaLabel: string, rows: Participant[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Crachás – ${courseTitle} – ${turmaLabel}`);
  pdf.setCreator("Smart Dent | Fluxo Digital");

  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

  // Carrega o template (fundo oficial com logos posicionados) embutido como base64
  const templateBytes = Uint8Array.from(atob(TEMPLATE_CRACHA_BASE64), (c) => c.charCodeAt(0));
  const [templatePage] = await pdf.embedPdf(templateBytes, [0]);

  if (!rows.length) {
    const page = pdf.addPage([A4_W, A4_H]);
    page.drawText("Nenhum participante inscrito nesta turma.", {
      x: 60, y: A4_H - 100, size: 14, font, color: MUTED,
    });
  }

  // Layout determinado pelo template: 2 crachás por página, cada um ocupando
  // metade da página (sem margens). Crachá superior = metade superior;
  // crachá inferior = metade inferior. Linha de dobra no meio de cada crachá.
  const badgeW = A4_W;
  const badgeH = A4_H / 2;

  for (let i = 0; i < rows.length; i += 2) {
    const page = pdf.addPage([A4_W, A4_H]);

    // Fundo: template oficial em toda a página
    page.drawPage(templatePage, {
      x: 0,
      y: 0,
      width: A4_W,
      height: A4_H,
    });

    const top = rows[i];
    const bottom = rows[i + 1];

    // Badge superior (metade superior da página)
    drawBadge(page, top, 0, A4_H / 2, badgeW, badgeH, font, fontBold);

    // Badge inferior (metade inferior da página)
    if (bottom) {
      drawBadge(page, bottom, 0, 0, badgeW, badgeH, font, fontBold);
    }
  }

  return await pdf.save();
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

    const { courseTitle, turmaLabel, rows } = await fetchParticipants(supabase, turmaId);
    const bytes = await buildPdf(courseTitle, turmaLabel, rows);

    const safeName = (turmaLabel || turmaId).replace(/[^a-zA-Z0-9]/g, "_");
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="crachas_${safeName}.pdf"`,
      },
    });
  } catch (err: any) {
    console.error("[smartops-gerar-crachas-turma]", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});