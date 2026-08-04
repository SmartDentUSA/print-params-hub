/**
 * Panda Video — destino oficial dos depoimentos de treinamento.
 *
 * Regras invioláveis:
 *  - a pasta de destino vem SOMENTE do segredo PANDAVIDEO_TESTIMONIALS_FOLDER_ID
 *    (nunca do frontend, nunca hardcoded no cliente);
 *  - se a pasta não existir ou estiver inacessível, o processamento é interrompido;
 *  - nunca há fallback silencioso para a raiz do Panda.
 */
const API_BASE = "https://api-v2.pandavideo.com.br";
const UPLOADER_FALLBACK = "https://uploader-us01.pandavideo.com.br";

export function pandaApiKey(): string {
  const key = Deno.env.get("PANDAVIDEO_API_KEY") || Deno.env.get("lVIDEO_API_KEY");
  if (!key) throw new Error("PANDAVIDEO_API_KEY ausente no backend");
  return key;
}

/** Pasta oficial dos depoimentos. Só do segredo — sem default, sem raiz. */
export function testimonialsFolderId(): string {
  const id = (Deno.env.get("PANDAVIDEO_TESTIMONIALS_FOLDER_ID") || "").trim();
  if (!id) {
    throw new Error(
      "PANDAVIDEO_TESTIMONIALS_FOLDER_ID ausente — upload interrompido (proibido enviar para a raiz do Panda)",
    );
  }
  return id;
}

async function pandaFetch(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Authorization: pandaApiKey(), "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Panda ${res.status} em ${path}: ${text.slice(0, 400)}`);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Panda retornou resposta não-JSON em ${path}`);
  }
}

/** Confirma que a pasta oficial existe e está acessível. Lança erro caso contrário. */
export async function assertTestimonialsFolder(): Promise<{ id: string; name: string | null }> {
  const folderId = testimonialsFolderId();
  let folder: any;
  try {
    folder = await pandaFetch(`/folders/${folderId}`);
  } catch (e) {
    throw new Error(`Pasta de depoimentos inacessível no Panda (${folderId}): ${(e as Error).message}`);
  }
  const found = folder?.folder ?? folder;
  if (!found?.id || String(found.id) !== folderId) {
    throw new Error(`Pasta de depoimentos não encontrada no Panda (${folderId}) — processamento interrompido`);
  }
  return { id: folderId, name: found?.name ?? null };
}

/** Uploader mais próximo; se a listagem falhar, usa o host padrão documentado. */
export async function pickUploaderHost(): Promise<string> {
  try {
    const data = await pandaFetch("/hosts/uploader");
    const list: any[] = data?.hosts || data?.uploaders || (Array.isArray(data) ? data : []);
    const host = list.find((h) => h?.url || h?.host)?.url || list.find((h) => h?.host)?.host;
    if (!host) return UPLOADER_FALLBACK;
    return String(host).startsWith("http") ? String(host) : `https://${host}`;
  } catch {
    return UPLOADER_FALLBACK;
  }
}

function b64(value: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(value)));
}

export interface PandaUploadInput {
  bytes: Uint8Array;
  filename: string;
  title: string;
  description: string;
  videoId: string;
  folderId: string;
}

/** Upload TUS em requisição única, sempre com folder_id explícito. */
export async function uploadTestimonialVideo(input: PandaUploadInput): Promise<void> {
  if (!input.folderId) throw new Error("folder_id ausente — upload abortado");
  const host = await pickUploaderHost();
  const metadata = [
    `authorization ${b64(pandaApiKey())}`,
    `folder_id ${b64(input.folderId)}`,
    `video_id ${b64(input.videoId)}`,
    `filename ${b64(input.filename)}`,
    `title ${b64(input.title)}`,
    `description ${b64(input.description)}`,
  ].join(", ");

  const res = await fetch(`${host}/files`, {
    method: "POST",
    headers: {
      "Tus-Resumable": "1.0.0",
      "Upload-Length": String(input.bytes.byteLength),
      "Content-Type": "application/offset+octet-stream",
      "Upload-Metadata": metadata,
    },
    body: input.bytes,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Upload Panda ${res.status}: ${text.slice(0, 400)}`);
}

export interface PandaVideoState {
  id: string;
  folder_id: string | null;
  status: string | null;
  title: string | null;
  description: string | null;
  video_external_id: string | null;
  video_player: string | null;
  video_hls: string | null;
  thumbnail: string | null;
  length: number | null;
  raw: any;
}

/** O id real do vídeo aparece no player (`.../embed/?v=<uuid>`). */
export function extractPandaVideoIdFromPlayer(playerUrl?: string | null): string | null {
  const m = /[?&]v=([0-9a-f-]{16,})/i.exec(String(playerUrl || ""));
  return m ? m[1] : null;
}

/**
 * Resolve o id do vídeo de forma defensiva: o player é a fonte mais confiável,
 * depois o id retornado pela API (desde que não seja o id da pasta) e por fim o
 * id que enviamos no upload. Evita gravar id de pasta em `pandavideo_id`.
 */
export function resolvePandaVideoId(
  state: { id?: string | null; video_player?: string | null } | null,
  uploadedId: string,
  folderId: string,
): string {
  const fromPlayer = extractPandaVideoIdFromPlayer(state?.video_player);
  if (fromPlayer) return fromPlayer;
  const apiId = state?.id ? String(state.id) : "";
  if (apiId && apiId !== folderId) return apiId;
  return uploadedId;
}

/** Remove um vídeo do Panda (usado para limpar artefatos de teste). */
export async function deletePandaVideo(videoId: string): Promise<void> {
  await pandaFetch(`/videos/${videoId}`, { method: "DELETE" });
}

export async function getPandaVideo(videoId: string): Promise<PandaVideoState | null> {
  try {
    const data = await pandaFetch(`/videos/${videoId}`);
    const v = data?.video ?? data;
    if (!v?.id) return null;
    return {
      id: String(v.id),
      folder_id: v.folder_id ? String(v.folder_id) : null,
      status: v.status ?? v.conversion_status ?? null,
      title: v.title ?? null,
      description: v.description ?? null,
      video_external_id: v.video_external_id ?? v.external_id ?? null,
      video_player: v.video_player ?? v.player ?? null,
      video_hls: v.video_hls ?? v.hls ?? null,
      thumbnail: v.thumbnail ?? v.thumb ?? null,
      length: typeof v.length === "number" ? v.length : (typeof v.duration === "number" ? v.duration : null),
      raw: v,
    };
  } catch (e) {
    if (String((e as Error).message).includes("Panda 404")) return null;
    throw e;
  }
}

/** Espera a conversão terminar (limite curto — o poll continua na próxima chamada). */
export async function waitForConversion(videoId: string, attempts = 12, delayMs = 5000): Promise<PandaVideoState | null> {
  let last: PandaVideoState | null = null;
  for (let i = 0; i < attempts; i++) {
    last = await getPandaVideo(videoId);
    const s = (last?.status || "").toUpperCase();
    if (s === "CONVERTED" || s === "READY" || s === "ERROR" || s === "FAILED") return last;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return last;
}

/** Nome oficial: `TURMA-157 | Nome do Participante | Chairside Print | Depoimento`. */
export function buildTestimonialTitle(input: {
  turmaNumber: number | string | null;
  participantName: string;
  courseTitle: string | null;
}): string {
  const turma = input.turmaNumber ? `TURMA-${input.turmaNumber}` : "TURMA";
  const shortCourse = String(input.courseTitle || "Treinamento")
    .split(/\s+[-–—]\s+/)[0]
    .trim();
  return `${turma} | ${input.participantName} | ${shortCourse} | Depoimento`;
}

const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function parseDate(value?: string | null): { d: number; m: number; y: number } | null {
  if (!value) return null;
  const m = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

/** "de 5 a 7 de agosto de 2026" — ou variações quando os meses/anos diferem. */
export function formatTrainingPeriod(startDate?: string | null, endDate?: string | null): string | null {
  const a = parseDate(startDate);
  const b = parseDate(endDate) || a;
  if (!a || !b) return null;
  if (a.y === b.y && a.m === b.m) {
    return a.d === b.d
      ? `em ${a.d} de ${MONTHS[a.m]} de ${a.y}`
      : `de ${a.d} a ${b.d} de ${MONTHS[a.m]} de ${a.y}`;
  }
  if (a.y === b.y) return `de ${a.d} de ${MONTHS[a.m]} a ${b.d} de ${MONTHS[b.m]} de ${a.y}`;
  return `de ${a.d} de ${MONTHS[a.m]} de ${a.y} a ${b.d} de ${MONTHS[b.m]} de ${b.y}`;
}

/**
 * Descrição oficial:
 * "Depoimento de {Nome} durante a Turma {N} — {Curso}, realizada em {Local}, de 5 a 7 de agosto de 2026."
 */
export function buildTestimonialDescription(input: {
  participantName: string;
  turmaNumber: number | string | null;
  courseTitle: string | null;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
}): string {
  const parts = [`Depoimento de ${input.participantName}`];
  parts.push(input.turmaNumber ? ` durante a Turma ${input.turmaNumber}` : " durante o treinamento");
  if (input.courseTitle) parts.push(` — ${input.courseTitle}`);
  const tail: string[] = [];
  if (input.location) tail.push(`realizada em ${input.location}`);
  const period = formatTrainingPeriod(input.startDate, input.endDate);
  if (period) tail.push(period);
  return `${parts.join("")}${tail.length ? `, ${tail.join(", ")}` : ""}.`;
}