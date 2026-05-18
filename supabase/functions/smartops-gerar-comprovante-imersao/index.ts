// Edge function: smartops-gerar-comprovante-imersao
// Generates an editable .docx "Declaração de Comparecimento à Imersão e Retirada"
// for a single participant (enrollment lead OR a companion).
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  HeadingLevel,
  LevelFormat,
  PageOrientation,
  TabStopType,
  TabStopPosition,
  BorderStyle,
} from "npm:docx@8.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const BLANK_LONG = "_______________________________________________";
const BLANK_MED = "________________________";
const BLANK_SHORT = "______";

function pickFirst(...vals: (string | null | undefined)[]): string {
  for (const v of vals) {
    if (v && String(v).trim().length > 0) return String(v).trim();
  }
  return "";
}

function formatDoc(value: string | null | undefined): string {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 11) {
    return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    return `${digits.slice(0,2)}.${digits.slice(2,5)}.${digits.slice(5,8)}/${digits.slice(8,12)}-${digits.slice(12)}`;
  }
  return String(value).trim();
}

function addDaysISO(iso: string, days: number): string {
  const dt = new Date(iso);
  if (isNaN(dt.getTime())) return iso;
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function fmtDate(d?: string | null): { dd: string; mm: string; yyyy: string } {
  if (!d) return { dd: "____", mm: "____", yyyy: "________" };
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return { dd: "____", mm: "____", yyyy: "________" };
  return {
    dd: String(dt.getUTCDate()).padStart(2, "0"),
    mm: String(dt.getUTCMonth() + 1).padStart(2, "0"),
    yyyy: String(dt.getUTCFullYear()),
  };
}

// Try to extract start/end dates from turma.label like "DD/MM a DD/MM/YYYY"
function parseTurmaLabel(
  label: string | null,
  launchDate: string | null,
): { start: string | null; end: string | null } {
  // Case A: range "DD/MM[/YYYY] a DD/MM/YYYY"
  if (label) {
    const rangeRe =
      /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\s*(?:a|–|—|-|to)\s*(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i;
    const m = label.match(rangeRe);
    if (m) {
      const yEnd = m[6].length === 2 ? `20${m[6]}` : m[6];
      const yStart = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : yEnd;
      return {
        start: `${yStart}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`,
        end: `${yEnd}-${m[5].padStart(2, "0")}-${m[4].padStart(2, "0")}`,
      };
    }
    // Case B: first DD/MM/YYYY anywhere in the label
    const single = label.match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
    if (single) {
      const y = single[3].length === 2 ? `20${single[3]}` : single[3];
      const startIso = `${y}-${single[2].padStart(2, "0")}-${single[1].padStart(2, "0")}`;
      return { start: startIso, end: addDaysISO(startIso, 2) };
    }
  }
  // Case C: launch_date fallback (imersão = 3 dias)
  if (launchDate) return { start: launchDate, end: addDaysISO(launchDate, 2) };
  return { start: null, end: null };
}

function p(text: string, opts: { bold?: boolean; align?: any; size?: number; spacingAfter?: number } = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacingAfter ?? 120 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 22 })],
  });
}

function bulletP(text: string, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}

function buildDocx(args: {
  declarante: string;
  cpfDeclarante: string;
  empresa: string;
  endereco: string;
  cidade: string;
  estado: string;
  contrato: string;
  startDD: string; startMM: string; startYY: string;
  endDD: string; endMM: string; endYY: string;
  participanteNome: string;
  participanteCpf: string;
  participanteProfissao: string;
  nf1: string; nf2: string;
}): Document {
  const a = args;
  return new Document({
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
            margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [
              new TextRun({ text: "MMTech Projetos Tecnológicos  ·  SMART DENT", bold: true, size: 22 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "888888", space: 4 } },
            children: [new TextRun({ text: "" })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: "DECLARAÇÃO DE COMPARECIMENTO À IMERSÃO, TREINAMENTO TÉCNICO E RETIRADA PRESENCIAL DE EQUIPAMENTO",
                bold: true,
                size: 24,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text:
                  `Pelo presente instrumento, eu, ${a.declarante || BLANK_LONG}, ` +
                  `inscrito(a) no CPF/CNPJ sob o nº ${a.cpfDeclarante || BLANK_MED}, ` +
                  `representando a empresa (se aplicável): ${a.empresa || BLANK_LONG}, ` +
                  `com sede/endereço em: ${a.endereco || BLANK_LONG}, ` +
                  `Cidade de: ${a.cidade || BLANK_MED} / Estado: ${a.estado || "____"}. ` +
                  `Contrato: ${a.contrato || BLANK_MED}.`,
                size: 22,
              }),
            ],
          }),
          p("DECLARO, para os devidos fins legais, que:", { bold: true, spacingAfter: 200 }),

          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 160 },
            children: [
              new TextRun({
                text:
                  "1. Compareci presencialmente à imersão técnica promovida pela empresa MMTECH PROJETOS TECNOLÓGICOS IMPORTAÇÃO E EXPORTAÇÃO LTDA, CNPJ nº 10.736.894/0001-36, com sede à Rua Dr. Procópio de Toledo Malta, nº 62, Morada dos Deuses, São Carlos/SP;",
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 160 },
            children: [
              new TextRun({
                text:
                  `2. A imersão ocorreu na cidade de São Carlos / SP, no período de ${a.startDD}/${a.startMM}/${a.startYY} a ${a.endDD}/${a.endMM}/${a.endYY}, com duração de 3 (três) dias, e teve como objetivo o treinamento técnico para operação e utilização dos equipamentos adquiridos;`,
                size: 22,
              }),
            ],
          }),
          p("3. Foi ministrado pelo instrutor o seguinte conteúdo programático descrito abaixo:", { spacingAfter: 120 }),

          p("    I. Integração Digital – Software de escaneamento e software de planejamento:", { bold: true }),
          bulletP("Cadastro de casos e calibração do equipamento;"),
          bulletP("Digitalização em ortodontia, prótese e implante;"),
          bulletP("Exportação e envio de arquivos."),

          p("    II. Planejamento Clínico Digital:", { bold: true }),
          bulletP("Projeto de modelos para impressão;"),
          bulletP("Desenhos anatômicos sobre preparo;"),
          bulletP("Design de placas oclusais."),

          p("    III. Impressão 3D na Odontologia:", { bold: true }),
          bulletP("Protocolos de resina e checklist;"),
          bulletP("Fatiadores, posicionamento e suportes;"),
          bulletP("Impressão de placas, coroas, pontes e modelos."),

          p("    IV. Operação e Manutenção de Equipamentos:", { bold: true }),
          bulletP("Impressoras 3D: estrutura e funções;"),
          bulletP("Wash & Cure;"),
          bulletP("Limpeza, filtragem e troca de resina."),

          p("    V. Acabamento e Caracterização:", { bold: true }),
          bulletP("Lavagem e preparação de peças;"),
          bulletP("Polimento e caracterização estética;"),
          bulletP("Testes de adaptação de modelos e placas."),

          p("4. Durante a imersão, participaram os seguintes profissionais indicados:", { spacingAfter: 160 }),

          p(`4.1 Nome: ${a.participanteNome || BLANK_LONG}`),
          p(`     CPF: ${a.participanteCpf || BLANK_MED}    Profissão: ${a.participanteProfissao || BLANK_MED}`),
          p(`4.2 Nome: ${BLANK_LONG}`),
          p(`     CPF: ${BLANK_MED}    Profissão: ${BLANK_MED}`),
          p(`4.3 Nome: ${BLANK_LONG}`),
          p(`     CPF: ${BLANK_MED}    Profissão: ${BLANK_MED}`, { spacingAfter: 200 }),

          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 160 },
            children: [
              new TextRun({
                text:
                  "5. Declaro que, ao término do treinamento, retirei presencialmente todos os equipamentos e produtos adquiridos junto à MMTECH PROJETOS TECNOLÓGICOS IMPORTAÇÃO E EXPORTAÇÃO LTDA, assumindo total responsabilidade pelo seu transporte, integridade e utilização conforme as orientações técnicas recebidas.",
                size: 22,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
            children: [
              new TextRun({
                text:
                  `6. Informo, ainda, que a retirada está vinculada às Notas Fiscais nº ${a.nf1 || BLANK_SHORT} / ${a.nf2 || BLANK_SHORT}, emitida pela empresa supracitada, caracterizando entrega definitiva realizada em seu estabelecimento.`,
                size: 22,
              }),
            ],
          }),

          p(
            "Declaro estar ciente de que este documento será mantido em arquivo pela MMTECH para fins de auditoria, controle interno e comprovação da entrega realizada.",
            { spacingAfter: 240 },
          ),

          p("Local: São Carlos, SP"),
          p(`Data: ${BLANK_SHORT}/${BLANK_SHORT}/${BLANK_SHORT}`, { spacingAfter: 480 }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
            children: [new TextRun({ text: BLANK_LONG, size: 22 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 80 },
            children: [new TextRun({ text: "Assinatura do Cliente / Representante Legal", size: 22 })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 360 },
            children: [new TextRun({ text: `CPF/CNPJ: ${a.cpfDeclarante || BLANK_MED}`, size: 22 })],
          }),

          p("Testemunhas:", { spacingAfter: 200 }),

          new Paragraph({
            tabStops: [
              { type: TabStopType.LEFT, position: 0 },
              { type: TabStopType.LEFT, position: 4500 },
            ],
            spacing: { after: 60 },
            children: [new TextRun({ text: `${BLANK_LONG}\t${BLANK_LONG}`, size: 22 })],
          }),
          new Paragraph({
            tabStops: [
              { type: TabStopType.LEFT, position: 0 },
              { type: TabStopType.LEFT, position: 4500 },
            ],
            spacing: { after: 60 },
            children: [new TextRun({ text: `Nome: ${BLANK_MED}\tNome: ${BLANK_MED}`, size: 22 })],
          }),
          new Paragraph({
            tabStops: [
              { type: TabStopType.LEFT, position: 0 },
              { type: TabStopType.LEFT, position: 4500 },
            ],
            spacing: { after: 360 },
            children: [new TextRun({ text: `CPF: ${BLANK_MED}\tCPF: ${BLANK_MED}`, size: 22 })],
          }),

          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 240 },
            border: { top: { style: BorderStyle.SINGLE, size: 4, color: "888888", space: 4 } },
            children: [
              new TextRun({
                text: "Rua Dr. Procópio de Toledo Malta, 62 – Morada dos Deuses · São Carlos/SP – CEP 13562-291",
                size: 18,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: "(16) 3415-0530 | (16) 3419-4735 — www.smartdent.com.br",
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const enrollmentId = url.searchParams.get("enrollment_id");
    const companionId = url.searchParams.get("companion_id");

    if (!enrollmentId) {
      return new Response(JSON.stringify({ error: "enrollment_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: enr, error: enrErr } = await admin
      .from("smartops_course_enrollments")
      .select(
        "id, person_name, lead_id, turma_id, empresa_cnpj, empresa_endereco, empresa_cidade, empresa_estado, numero_contrato, numero_nf, especialidade",
      )
      .eq("id", enrollmentId)
      .maybeSingle();

    if (enrErr || !enr) {
      return new Response(JSON.stringify({ error: "Inscrição não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all companions of this enrollment (used for 4.2/4.3 when generating titular's doc)
    const { data: allCompanions } = await admin
      .from("smartops_enrollment_companions")
      .select("id, name, cpf, especialidade")
      .eq("enrollment_id", enrollmentId);
    const companions = allCompanions || [];

    let participantName = enr.person_name || "";
    let participantEspecialidade = enr.especialidade || "";
    let participantCpfRaw = "";
    let isCompanion = false;
    if (companionId) {
      isCompanion = true;
      const comp = companions.find((c: any) => c.id === companionId);
      if (comp) {
        participantName = comp.name;
        participantEspecialidade = comp.especialidade || enr.especialidade || "";
        participantCpfRaw = comp.cpf || "";
      }
    }

    const { data: turma } = await admin
      .from("smartops_course_turmas")
      .select("label, launch_date")
      .eq("id", enr.turma_id)
      .maybeSingle();

    let lead: any = null;
    if (enr.lead_id) {
      const { data: l } = await admin
        .from("lia_attendances")
        .select(
          "nome, pessoa_cpf, pessoa_cargo, pessoa_endereco, especialidade, empresa_nome, empresa_razao_social, empresa_cnpj, empresa_endereco, empresa_cidade, empresa_uf, cidade, uf",
        )
        .eq("id", enr.lead_id)
        .is("merged_into", null)
        .maybeSingle();
      lead = l;
    }

    // Try to fetch up to 2 most recent NFs from Omie for this lead
    let omieNfs: any[] = [];
    if (enr.lead_id) {
      const { data: nfs } = await admin
        .from("omie_notas_fiscais")
        .select("numero_nf, cliente_nome, cliente_cpf_cnpj, data_emissao")
        .eq("lead_id", enr.lead_id)
        .order("data_emissao", { ascending: false })
        .limit(2);
      omieNfs = nfs || [];
    }

    const dates = parseTurmaLabel(turma?.label || null, turma?.launch_date || null);
    const start = fmtDate(dates.start);
    const end = fmtDate(dates.end || dates.start);

    // Cascata de fontes
    const declaranteName = pickFirst(enr.person_name, lead?.nome);
    const cpfDeclaranteRaw = pickFirst(
      lead?.pessoa_cpf,
      enr.empresa_cnpj,
      lead?.empresa_cnpj,
    );
    const empresa = pickFirst(
      lead?.empresa_razao_social,
      lead?.empresa_nome,
      omieNfs[0]?.cliente_nome,
    );
    const endereco = pickFirst(enr.empresa_endereco, lead?.empresa_endereco, lead?.pessoa_endereco);
    const cidade = pickFirst(enr.empresa_cidade, lead?.empresa_cidade, lead?.cidade);
    const estado = pickFirst(enr.empresa_estado, lead?.empresa_uf, lead?.uf);
    const contrato = pickFirst(enr.numero_contrato);

    // NFs: prefer enrollment.numero_nf, fallback to omie
    const nfParts = (enr.numero_nf || "").split(/[\s,;\/]+/).filter(Boolean);
    const nf1 = pickFirst(nfParts[0], omieNfs[0]?.numero_nf);
    const nf2 = pickFirst(nfParts[1], omieNfs[1]?.numero_nf);

    // Participante principal (4.1)
    const part41Nome = participantName || lead?.nome || "";
    const part41Cpf = isCompanion ? participantCpfRaw : pickFirst(lead?.pessoa_cpf);
    const part41Prof = pickFirst(participantEspecialidade, lead?.pessoa_cargo, lead?.especialidade);

    // 4.2 / 4.3 — apenas no doc do titular, preenche com até 2 acompanhantes
    const extras = isCompanion ? [] : companions.slice(0, 2);
    const part42 = extras[0];
    const part43 = extras[1];

    const doc = buildDocx({
      declarante: declaranteName,
      cpfDeclarante: formatDoc(cpfDeclaranteRaw),
      empresa,
      endereco,
      cidade,
      estado,
      contrato,
      startDD: start.dd, startMM: start.mm, startYY: start.yyyy,
      endDD: end.dd, endMM: end.mm, endYY: end.yyyy,
      participanteNome: part41Nome,
      participanteCpf: formatDoc(part41Cpf),
      participanteProfissao: part41Prof,
      participante2Nome: part42?.name || "",
      participante2Cpf: formatDoc(part42?.cpf || ""),
      participante2Profissao: part42?.especialidade || "",
      participante3Nome: part43?.name || "",
      participante3Cpf: formatDoc(part43?.cpf || ""),
      participante3Profissao: part43?.especialidade || "",
      nf1,
      nf2,
    });

    const buffer = await Packer.toBuffer(doc);
    const safe = (participantName || "participante")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .slice(0, 60);
    const safeTurma = (turma?.label || enr.turma_id)
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .slice(0, 40);

    return new Response(buffer, {
      headers: {
        ...corsHeaders,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="comprovante_${safe}_${safeTurma}.docx"`,
      },
    });
  } catch (e) {
    console.error("[smartops-gerar-comprovante-imersao]", e);
    return new Response(
      JSON.stringify({ error: (e as Error).message || String(e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});