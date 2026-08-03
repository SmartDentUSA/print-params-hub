// Server-side naming rules for training media. The browser NEVER decides the
// final filename — this module is the only source of truth.

export type MediaKind = "photo" | "video";

export interface DestinationSpec {
  key: string;
  kind: MediaKind;
  /** Token used inside the generated filename. */
  token: string;
  /** Friendly Drive path shown to the user. */
  label: string;
  /** Requires day classification (Dia 1/2/3/Geral). */
  requiresDay: boolean;
  testimonial?: boolean;
}

export const DESTINATIONS: Record<string, DestinationSpec> = {
  fotos_turma: { key: "fotos_turma", kind: "photo", token: "FOTO_TURMA", label: "03 - Fotos Originais › 01 - Foto da Turma", requiresDay: false },
  fotos_participantes_certificados: { key: "fotos_participantes_certificados", kind: "photo", token: "FOTO_PARTICIPANTES_CERTIFICADOS", label: "03 - Fotos Originais › 02 - Participantes com Certificados", requiresDay: false },
  fotos_atividades: { key: "fotos_atividades", kind: "photo", token: "FOTO_ATIVIDADES", label: "03 - Fotos Originais › 03 - Atividades Práticas", requiresDay: false },
  fotos_equipamentos: { key: "fotos_equipamentos", kind: "photo", token: "FOTO_EQUIPAMENTOS", label: "03 - Fotos Originais › 04 - Equipamentos e Resultados", requiresDay: false },
  fotos_bastidores: { key: "fotos_bastidores", kind: "photo", token: "FOTO_BASTIDORES", label: "03 - Fotos Originais › 05 - Bastidores", requiresDay: false },
  videos_vertical: { key: "videos_vertical", kind: "video", token: "VIDEO_VERTICAL", label: "04 - Vídeos Originais › 01 - Vídeos Verticais", requiresDay: true },
  videos_horizontal: { key: "videos_horizontal", kind: "video", token: "VIDEO_HORIZONTAL", label: "04 - Vídeos Originais › 02 - Vídeos Horizontais", requiresDay: true },
  videos_depoimentos: { key: "videos_depoimentos", kind: "video", token: "DEPOIMENTO", label: "04 - Vídeos Originais › 03 - Depoimentos", requiresDay: false, testimonial: true },
  videos_atividades: { key: "videos_atividades", kind: "video", token: "ATIVIDADE_PRATICA", label: "04 - Vídeos Originais › 04 - Atividades Práticas", requiresDay: true },
  videos_bastidores: { key: "videos_bastidores", kind: "video", token: "BASTIDORES", label: "04 - Vídeos Originais › 05 - Bastidores", requiresDay: true },
};

/** MIME allowlist → canonical extension. Extension from the browser is ignored. */
export const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/pjpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
  "video/x-m4v": "m4v",
};

export function kindOfMime(mime: string): MediaKind | null {
  if (!MIME_EXT[mime]) return null;
  return mime.startsWith("image/") ? "photo" : "video";
}

function stripAccents(s: string): string {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/** UPPER_SNAKE token (course names, categories). */
export function upperSnake(input: string): string {
  return stripAccents(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "SEM_NOME";
}

/** UPPER-KEBAB token (participant names). */
export function upperKebab(input: string): string {
  return stripAccents(input)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "SEM-NOME";
}

export interface NameParts {
  turmaNumber: number | string;
  courseTitle: string;
  destination: DestinationSpec;
  /** ISO date (yyyy-mm-dd) of the training day, when applicable. */
  trainingDate?: string | null;
  trainingDay?: number | null;
  participantName?: string | null;
  mimeType: string;
}

/** Filename without the sequence suffix, e.g. T154_CHAIRSIDE_PRINT_..._VIDEO_VERTICAL */
export function buildNamePrefix(p: NameParts): string {
  const segs: string[] = [`T${p.turmaNumber ?? "SN"}`, upperSnake(p.courseTitle || "TREINAMENTO")];
  if (p.destination.testimonial) {
    segs.push(p.destination.token, upperKebab(p.participantName || "PARTICIPANTE-NAO-LOCALIZADO"));
  } else if (p.destination.requiresDay) {
    if (p.trainingDay && p.trainingDate) {
      segs.push(p.trainingDate, `DIA-${p.trainingDay}`);
    } else {
      segs.push("GERAL");
    }
    segs.push(p.destination.token);
  } else {
    segs.push("GERAL", p.destination.token);
  }
  return segs.join("_");
}

/** Next free sequence for a prefix given existing names in the folder. */
export function nextSequence(prefix: string, existing: string[]): number {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_(\\d{3,})\\.`, "i");
  let max = 0;
  for (const n of existing) {
    const m = n.match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export function buildGeneratedFilename(p: NameParts, existing: string[]): { prefix: string; filename: string; sequence: number } {
  const prefix = buildNamePrefix(p);
  const ext = MIME_EXT[p.mimeType];
  const sequence = nextSequence(prefix, existing);
  return { prefix, sequence, filename: `${prefix}_${String(sequence).padStart(3, "0")}.${ext}` };
}
