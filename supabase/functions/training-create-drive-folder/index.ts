import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  getDriveAccessToken,
  driveCreateFolder,
  driveEnsureFolder,
  driveUploadFile,
  sanitizeFolderName,
} from "../_shared/drive.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const GOOGLE_DRIVE_PARENT_FOLDER_ID = Deno.env.get("GOOGLE_DRIVE_PARENT_FOLDER_ID");

const MESES_PT_LONG = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

type FolderNode = { key: string; name: string; children?: FolderNode[] };
const FOLDER_TREE: FolderNode[] = [
  { key: "dados", name: "01 - Dados da Imersão" },
  {
    key: "certificados",
    name: "02 - Certificados",
    children: [
      { key: "certificados_individuais", name: "01 - Individuais" },
      { key: "certificados_pacote", name: "02 - Pacote Completo" },
    ],
  },
  {
    key: "fotos",
    name: "03 - Fotos Originais",
    children: [
      { key: "fotos_turma", name: "01 - Foto da Turma" },
      { key: "fotos_participantes_certificados", name: "02 - Participantes com Certificados" },
      { key: "fotos_atividades", name: "03 - Atividades Práticas" },
      { key: "fotos_equipamentos", name: "04 - Equipamentos e Resultados" },
      { key: "fotos_bastidores", name: "05 - Bastidores" },
    ],
  },
  {
    key: "videos",
    name: "04 - Vídeos Originais",
    children: [
      { key: "videos_vertical", name: "01 - Vídeos Verticais" },
      { key: "videos_horizontal", name: "02 - Vídeos Horizontais" },
      { key: "videos_depoimentos", name: "03 - Depoimentos" },
      { key: "videos_atividades", name: "04 - Atividades Práticas" },
      { key: "videos_bastidores", name: "05 - Bastidores" },
    ],
  },
  {
    key: "entregas",
    name: "05 - Entregas",
    children: [
      { key: "entregas_carrossel", name: "01 - Carrossel Instagram" },
      { key: "entregas_stories", name: "02 - Stories" },
      { key: "entregas_reels", name: "03 - Reels" },
      { key: "entregas_thumb_yt", name: "04 - Thumbnail YouTube" },
      { key: "entregas_reddit", name: "05 - Reddit" },
      { key: "entregas_legendas", name: "06 - Legendas e Textos" },
    ],
  },
];

type YMD = { y: number; m: number; d: number };

function parseYMD(raw: unknown): YMD | null {
  if (!raw) return null;
  const s = String(raw).trim().slice(0, 10);
  const parts = s.includes("/") ? s.split("/").map(Number) : s.split("-").map(Number);
  const [y, m, d] = s.includes("/")
    ? [parts[2], parts[1], parts[0]]
    : parts;
  if (!y || !m || !d) return null;
  return { y, m, d };
}

function extractDays(factoryData: any): YMD[] {
  const days = factoryData?.days || factoryData?.dias || factoryData?.turma?.days || factoryData?.turma?.dias || [];
  const parsed = (days as any[])
    .map((x: any) => parseYMD(x?.day_date || x?.date || x?.data || x))
    .filter((x): x is YMD => !!x)
    .sort((a, b) => a.y - b.y || a.m - b.m || a.d - b.d);
  if (parsed.length) return parsed;
  const start = parseYMD(factoryData?.start_date || factoryData?.turma?.start_date);
  const end = parseYMD(factoryData?.end_date || factoryData?.turma?.end_date);
  return [start, end]
    .filter((x): x is YMD => !!x)
    .filter((x, index, all) => index === 0 || x.y !== all[0].y || x.m !== all[0].m || x.d !== all[0].d);
}

function getCourseName(factoryData: any): string {
  const course = factoryData?.curso ?? factoryData?.course ?? factoryData?.turma?.curso;
  if (typeof course === "string" && course.trim()) return course.trim();
  return course?.name || course?.title || course?.slug || "Treinamento";
}

function fmtDDMMYYYY(x: YMD): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(x.d)}-${pad(x.m)}-${x.y}`;
}

function formatFolderDateRange(days: YMD[]): string {
  if (!days.length) return "sem-data";
  const first = days[0];
  const last = days[days.length - 1];
  if (days.length === 1 || (first.y === last.y && first.m === last.m && first.d === last.d)) {
    return fmtDDMMYYYY(first);
  }
  if (first.y === last.y && first.m === last.m) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(first.d)} a ${pad(last.d)}-${pad(first.m)}-${first.y}`;
  }
  return `${fmtDDMMYYYY(first)} a ${fmtDDMMYYYY(last)}`;
}

function formatHumanDateLine(days: YMD[]): string {
  if (!days.length) return "—";
  if (days.length === 1) {
    const x = days[0];
    return `${x.d} de ${MESES_PT_LONG[x.m - 1]} de ${x.y}`;
  }
  const sameMonth = days.every((x) => x.m === days[0].m && x.y === days[0].y);
  if (sameMonth) {
    const list = days.map((x) => x.d).join(", ").replace(/,([^,]*)$/, " e$1");
    return `${list} de ${MESES_PT_LONG[days[0].m - 1]} de ${days[0].y}`;
  }
  const parts = days.map((x) => `${x.d}/${x.m}`);
  return `${parts.join(", ")} de ${days[days.length - 1].y}`;
}

function buildDescricaoTxt(factoryData: any): string {
  const turma = factoryData?.turma || factoryData;
  const cursoRaw = factoryData?.curso || factoryData?.course || {};
  const curso = typeof cursoRaw === "object" ? cursoRaw : {};
  const days = extractDays(factoryData);
  const numero = turma?.turma_number ?? turma?.number ?? "S/N";
  const nome = getCourseName(factoryData);
  const modalidade = (turma?.modality || curso?.modality || "presencial")
    .toString()
    .replace(/_/g, " ");
  const local = turma?.location || factoryData?.location || curso?.location || "";
  const linkOnline = turma?.meeting_link || "";
  const instrutor = turma?.instructor_name || turma?.instrutor || curso?.instructor_name || "";
  const enrolled = factoryData?.total_participantes ?? factoryData?.enrolled_count ?? turma?.enrolled_count ?? "";
  const horario =
    turma?.start_time && turma?.end_time ? `${turma.start_time} – ${turma.end_time}` : "";
  const status = turma?.status || turma?.factory_status || "";
  const descricao = curso?.description || turma?.description || "";
  const conteudo =
    curso?.content || curso?.objectives || turma?.content || turma?.objectives || "";
  const observacoes = turma?.notes || turma?.internal_notes || "";

  const title = `IMERSÃO ${numero} — ${String(nome).toUpperCase()}`;
  const localLine = modalidade.toLowerCase().includes("presencial")
    ? local
    : (linkOnline || "Online");

  const parts = [
    title,
    "",
    `Número: ${numero}`,
    `Treinamento: ${nome}`,
    `Modalidade: ${modalidade.charAt(0).toUpperCase()}${modalidade.slice(1)}`,
    `Data: ${formatHumanDateLine(days)}`,
    `Horário: ${horario}`,
    `Local: ${localLine}`,
    `Instrutor(es): ${instrutor}`,
    `Quantidade de participantes: ${enrolled}`,
    `Status: ${status}`,
    "",
    "DESCRIÇÃO",
    descricao || "—",
    "",
    "CONTEÚDO / OBJETIVOS",
    conteudo || "—",
    "",
    "OBSERVAÇÕES",
    observacoes || "—",
    "",
    "ORIENTAÇÃO PARA COMUNICAÇÃO",
    "Utilizar os nomes dos participantes somente na legenda da publicação.",
    "Não inserir nomes, telefones, documentos, contratos ou outras informações",
    "pessoais nas artes.",
    "",
  ];
  return parts.join("\n");
}

async function ensureTree(
  token: string,
  rootId: string,
  existing: Record<string, string> = {},
): Promise<Record<string, string>> {
  const map: Record<string, string> = { ...existing };
  async function walk(nodes: FolderNode[], parentId: string) {
    for (const node of nodes) {
      let id = map[node.key];
      if (!id) {
        id = await driveEnsureFolder(token, parentId, node.name);
        map[node.key] = id;
      }
      if (node.children?.length) await walk(node.children, id);
    }
  }
  await walk(FOLDER_TREE, rootId);
  return map;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!GOOGLE_DRIVE_API_KEY || !LOVABLE_API_KEY || !GOOGLE_DRIVE_PARENT_FOLDER_ID) {
      return new Response(
        JSON.stringify({ error: "Conector Google Drive não vinculado ou GOOGLE_DRIVE_PARENT_FOLDER_ID não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const turma_id: string | undefined = body?.turma_id;
    const update_only: boolean = !!body?.update_only;
    const refresh_description: boolean = !!body?.refresh_description;
    if (!turma_id || typeof turma_id !== "string") {
      return new Response(JSON.stringify({ error: "turma_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: factoryData, error: rpcErr } = await supabase.rpc("fn_get_turma_factory_data", {
      p_turma_id: turma_id,
    });
    if (rpcErr) throw new Error(`fn_get_turma_factory_data: ${rpcErr.message}`);
    if (!factoryData) throw new Error("Turma não encontrada");

    const { data: turmaRow, error: turmaErr } = await supabase
      .from("smartops_course_turmas")
      .select(
        "id, drive_folder_id, drive_folder_url, drive_folder_name, drive_folder_created_at, drive_subfolders, drive_descricao_file_id, factory_drive_folder_id, factory_drive_folder_url",
      )
      .eq("id", turma_id)
      .maybeSingle();
    if (turmaErr) throw new Error(`turma fetch: ${turmaErr.message}`);

    const token = await getDriveAccessToken();
    let folderId: string | null =
      turmaRow?.drive_folder_id || turmaRow?.factory_drive_folder_id || null;
    let folderUrl: string | null =
      turmaRow?.drive_folder_url || turmaRow?.factory_drive_folder_url || null;
    let folderName: string | null = turmaRow?.drive_folder_name || null;
    let subfolders: Record<string, string> =
      (turmaRow?.drive_subfolders as Record<string, string>) || {};
    let descricaoFileId: string | null = turmaRow?.drive_descricao_file_id || null;
    let created = false;

    const turma = (factoryData as any)?.turma || (factoryData as any);
    const days = extractDays(factoryData);
    const turmaNumber = turma?.turma_number ?? turma?.number ?? "S/N";
    const cursoNome = getCourseName(factoryData);
    const dateStr = days.length ? formatFolderDateRange(days) : "sem-data";
    const canonicalName = sanitizeFolderName(
      `Imersão ${turmaNumber} - ${cursoNome} - ${dateStr}`,
    );

    // Legacy factory folders were created by a Service Account, often in a
    // different parent. They are not the canonical OAuth folders requested by
    // this feature. A canonical folder is valid only after its creation marker
    // has been persisted by this function.
    const hasCanonicalFolder = !!turmaRow?.drive_folder_id && !!turmaRow?.drive_folder_created_at;
    if (!hasCanonicalFolder) {
      folderId = null;
      folderUrl = null;
      folderName = null;
      subfolders = {};
      descricaoFileId = null;
    }

    if (!folderId && !update_only) {
      folderId = await driveCreateFolder(token, canonicalName, GOOGLE_DRIVE_PARENT_FOLDER_ID);
      folderUrl = `https://drive.google.com/drive/folders/${folderId}`;
      folderName = canonicalName;
      created = true;
    }

    let updatedJson = false;
    if (folderId) {
      subfolders = await ensureTree(token, folderId, subfolders);

      try {
        await driveUploadFile({
          token,
          folderId,
          name: "turma.json",
          content: JSON.stringify(factoryData, null, 2),
          mimeType: "application/json",
          overwriteByName: true,
        });
        updatedJson = true;
      } catch (e) {
        console.warn(`[training-create-drive-folder] turma.json falhou: ${(e as Error).message}`);
      }

      const dadosId = subfolders["dados"];
      if (dadosId && (created || refresh_description || !descricaoFileId)) {
        try {
          const txt = buildDescricaoTxt(factoryData);
          descricaoFileId = await driveUploadFile({
            token,
            folderId: dadosId,
            name: "descricao_da_imersao.txt",
            content: txt,
            mimeType: "text/plain; charset=utf-8",
            existingFileId: descricaoFileId || undefined,
            overwriteByName: true,
          });
        } catch (e) {
          console.warn(`[training-create-drive-folder] descricao TXT falhou: ${(e as Error).message}`);
        }
      }

      const updatePayload: Record<string, unknown> = {
        drive_folder_id: folderId,
        drive_folder_url: folderUrl,
        drive_folder_name: folderName ?? canonicalName,
        drive_subfolders: subfolders,
        drive_descricao_file_id: descricaoFileId,
        factory_drive_folder_id: folderId,
        factory_drive_folder_url: folderUrl,
      };
      if (created) updatePayload.drive_folder_created_at = new Date().toISOString();

      const { error: updErr } = await supabase
        .from("smartops_course_turmas")
        .update(updatePayload)
        .eq("id", turma_id);
      if (updErr) throw new Error(`update turma: ${updErr.message}`);
      console.log(JSON.stringify({
        event: "drive_folder_ready",
        turma_id,
        parent_id: GOOGLE_DRIVE_PARENT_FOLDER_ID,
        folder_id: folderId,
        folder_name: folderName ?? canonicalName,
        created,
      }));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        folder_id: folderId,
        folder_url: folderUrl,
        folder_name: folderName,
        subfolders,
        created,
        updated_json: updatedJson,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[training-create-drive-folder]", err);
    return new Response(JSON.stringify({ error: err?.message || String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});