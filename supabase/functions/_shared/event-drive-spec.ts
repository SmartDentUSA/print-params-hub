// Fonte única da árvore de pastas do Drive de EVENTOS (congressos/feiras) e do
// naming dos arquivos. O navegador nunca decide nome de arquivo nem destino:
// o descritivo é gerado aqui, gravado em smartops_events.drive_destinations e
// consumido tanto pela criação de pastas quanto pelo upload.

export type EventMediaKind = "photo" | "video" | "both";

export interface EventDestination {
  key: string;
  /** Caminho amigável mostrado ao usuário. */
  label: string;
  /** Token usado no nome do arquivo. */
  token: string;
  kind: EventMediaKind;
  /** Dia do evento (1..N) quando aplicável. */
  day?: number | null;
  /** Data ISO do dia, quando aplicável. */
  date?: string | null;
  /** Palestrante/KOL dono da pasta, quando aplicável. */
  speaker?: string | null;
  /** Frase que descreve o objetivo do conteúdo (usada nas copies). */
  purpose: string;
  /** Grupo lógico para agrupar na UI. */
  group: string;
}

export interface EventSpeakerLite {
  name?: string | null;
  theme?: string | null;
  instagram?: string | null;
}

export interface EventLite {
  id: string;
  name: string;
  location?: string | null;
  country?: string | null;
  company_stand?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  days_count?: number | null;
  speakers?: EventSpeakerLite[] | null;
}

export const MESES_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

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

export function kindOfMime(mime: string): "photo" | "video" | null {
  if (!MIME_EXT[mime]) return null;
  return mime.startsWith("image/") ? "photo" : "video";
}

export function acceptsKind(dest: EventDestination, kind: "photo" | "video"): boolean {
  return dest.kind === "both" || dest.kind === kind;
}

function stripAccents(s: string): string {
  return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function upperSnake(input: string): string {
  return stripAccents(input).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "SEM_NOME";
}

export function upperKebab(input: string): string {
  return stripAccents(input).toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "SEM-NOME";
}

export function slugKey(input: string): string {
  return stripAccents(input).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40) || "sem_nome";
}

/** Dias do evento (ISO) a partir de start/end ou days_count. */
export function eventDays(ev: EventLite): { day: number; date: string | null }[] {
  const start = ev.start_date ? new Date(`${String(ev.start_date).slice(0, 10)}T00:00:00Z`) : null;
  const end = ev.end_date ? new Date(`${String(ev.end_date).slice(0, 10)}T00:00:00Z`) : null;
  let total = Number(ev.days_count || 0);
  if (!total && start && end) {
    total = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  }
  if (!total || total < 1) total = start ? 1 : 1;
  if (total > 10) total = 10;
  const out: { day: number; date: string | null }[] = [];
  for (let i = 0; i < total; i += 1) {
    let iso: string | null = null;
    if (start) {
      const d = new Date(start.getTime() + i * 86_400_000);
      iso = d.toISOString().slice(0, 10);
    }
    out.push({ day: i + 1, date: iso });
  }
  return out;
}

export function speakerNames(ev: EventLite): string[] {
  const list = Array.isArray(ev.speakers) ? ev.speakers : [];
  const names = list.map((s) => String(s?.name || "").trim()).filter(Boolean);
  return Array.from(new Set(names));
}

/** Nome canônico da pasta raiz: Nome do evento | Local | Mês Ano */
export function eventFolderName(ev: EventLite): string {
  const parts: string[] = [String(ev.name || "Evento").trim()];
  const local = [ev.location, ev.country].filter(Boolean).join(" - ");
  if (local) parts.push(local);
  const iso = ev.start_date || ev.end_date;
  if (iso) {
    const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`);
    parts.push(`${MESES_PT[d.getUTCMonth()]} ${d.getUTCFullYear()}`);
  }
  return parts.join(" | ");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Árvore completa: cada destino carrega o caminho de pastas (segments). */
export interface EventFolderPlan extends EventDestination {
  /** Caminho de pastas a partir da raiz do evento. */
  segments: string[];
}

export function buildEventPlan(ev: EventLite): EventFolderPlan[] {
  const evName = String(ev.name || "Evento").trim();
  const days = eventDays(ev);
  const speakers = speakerNames(ev);
  const plan: EventFolderPlan[] = [];
  const bastidores = "01 - Bastidores";
  const pre = "01 - Pré-evento";

  plan.push({
    key: "bastidores_pre_videos",
    label: `${bastidores} › ${pre} › 01 - Vídeos bastidores`,
    segments: [bastidores, pre, "01 - Vídeos bastidores"],
    token: "BASTIDORES_PRE",
    kind: "both",
    purpose: `bastidores da preparação da Smart Dent antes do ${evName}`,
    group: "Bastidores",
  });

  const kolsFolder = "02 - Chamadas KOLs para o evento";
  plan.push({
    key: "bastidores_pre_kols",
    label: `${bastidores} › ${pre} › ${kolsFolder}`,
    segments: [bastidores, pre, kolsFolder],
    token: "CHAMADA_KOL",
    kind: "video",
    purpose: `chamada/convite de KOL para visitar o estande da Smart Dent no ${evName}`,
    group: "Bastidores",
  });
  for (const sp of speakers) {
    plan.push({
      key: `bastidores_pre_kols__${slugKey(sp)}`,
      label: `${bastidores} › ${pre} › ${kolsFolder} › ${sp}`,
      segments: [bastidores, pre, kolsFolder, sp],
      token: "CHAMADA_KOL",
      kind: "video",
      speaker: sp,
      purpose: `chamada/convite de ${sp} para visitar o estande da Smart Dent no ${evName}`,
      group: "Bastidores",
    });
  }

  for (const d of days) {
    const folder = `${pad2(d.day + 1)} - Dia ${d.day}`;
    plan.push({
      key: `bastidores_dia${d.day}`,
      label: `${bastidores} › ${folder}`,
      segments: [bastidores, folder],
      token: "BASTIDORES",
      kind: "both",
      day: d.day,
      date: d.date,
      purpose: `bastidores da equipe Smart Dent no dia ${d.day} do ${evName}`,
      group: "Bastidores",
    });
  }

  days.forEach((d, idx) => {
    const dayFolder = `${pad2(idx + 2)} - Dia ${d.day} - ${evName}`;
    const group = `Dia ${d.day}`;
    const items: Array<{ key: string; name: string; token: string; kind: EventMediaKind; purpose: string; perSpeaker?: boolean }> = [
      {
        key: `dia${d.day}_video_inicio`,
        name: `01 - Vídeo editado início do dia ${d.day} - ${evName}`,
        token: "VIDEO_INICIO",
        kind: "video",
        purpose: `abertura do dia ${d.day} no estande da Smart Dent no ${evName}`,
      },
      {
        key: `dia${d.day}_depoimentos_stand`,
        name: `02 - Depoimentos clientes no stand dia ${d.day} - ${evName}`,
        token: "DEPOIMENTO_STAND",
        kind: "video",
        purpose: `depoimento de cliente gravado no estande da Smart Dent no ${evName}`,
      },
      {
        key: `dia${d.day}_demos_kols`,
        name: `03 - Demonstrações e chamadas KOLs dia ${d.day} - ${evName}`,
        token: "DEMO_KOL",
        kind: "video",
        purpose: `demonstração de equipamento/fluxo digital com KOL no estande da Smart Dent no ${evName}`,
        perSpeaker: true,
      },
      {
        key: `dia${d.day}_fotos_clientes_stand`,
        name: `04 - Fotos dos clientes no stand dia ${d.day} - ${evName}`,
        token: "FOTO_CLIENTES_STAND",
        kind: "photo",
        purpose: `foto de clientes visitando o estande da Smart Dent no ${evName}`,
      },
      {
        key: `dia${d.day}_fotos_stand`,
        name: `05 - Fotos do estande durante o congresso dia ${d.day} - ${evName}`,
        token: "FOTO_STAND",
        kind: "photo",
        purpose: `foto do estande da Smart Dent em operação durante o ${evName}`,
      },
      {
        key: `dia${d.day}_video_fechamento`,
        name: `06 - Vídeo editado de fechamento do dia ${d.day} - ${evName}`,
        token: "VIDEO_FECHAMENTO",
        kind: "video",
        purpose: `fechamento do dia ${d.day} no estande da Smart Dent no ${evName}`,
      },
    ];

    for (const it of items) {
      plan.push({
        key: it.key,
        label: `${dayFolder} › ${it.name}`,
        segments: [dayFolder, it.name],
        token: it.token,
        kind: it.kind,
        day: d.day,
        date: d.date,
        purpose: it.purpose,
        group,
      });
      if (it.perSpeaker) {
        for (const sp of speakers) {
          plan.push({
            key: `${it.key}__${slugKey(sp)}`,
            label: `${dayFolder} › ${it.name} › ${sp}`,
            segments: [dayFolder, it.name, sp],
            token: it.token,
            kind: it.kind,
            day: d.day,
            date: d.date,
            speaker: sp,
            purpose: `demonstração/chamada com ${sp} no estande da Smart Dent no ${evName}`,
            group,
          });
        }
      }
    }
  });

  const finalFolder = `${pad2(days.length + 2)} - Final`;
  plan.push({
    key: "final_video_agradecimento",
    label: `${finalFolder} › 01 - Vídeo editado de agradecimento`,
    segments: [finalFolder, "01 - Vídeo editado de agradecimento"],
    token: "VIDEO_AGRADECIMENTO",
    kind: "video",
    purpose: `agradecimento da Smart Dent aos visitantes do estande no ${evName}`,
    group: "Final",
  });
  plan.push({
    key: "final_foto_equipe",
    label: `${finalFolder} › 02 - Foto da equipe no final do congresso`,
    segments: [finalFolder, "02 - Foto da equipe no final do congresso"],
    token: "FOTO_EQUIPE",
    kind: "photo",
    purpose: `foto da equipe Smart Dent no encerramento do ${evName}`,
    group: "Final",
  });

  return plan;
}

/** Descritores persistidos (sem os segmentos de pasta). */
export function planToDestinations(plan: EventFolderPlan[]): EventDestination[] {
  return plan.map(({ segments: _segments, ...rest }) => rest);
}

export interface EventNameParts {
  eventName: string;
  destination: EventDestination;
  mimeType: string;
}

export function buildEventNamePrefix(p: EventNameParts): string {
  const d = p.destination;
  const segs: string[] = ["EVT", upperSnake(p.eventName)];
  if (d.day) segs.push(`DIA-${d.day}`);
  else segs.push("GERAL");
  segs.push(d.token);
  if (d.speaker) segs.push(upperKebab(d.speaker));
  return segs.join("_");
}

export function nextSequence(prefix: string, existing: string[]): number {
  const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}_(\\d{3,})\\.`, "i");
  let max = 0;
  for (const n of existing) {
    const m = String(n || "").match(re);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return max + 1;
}

export function buildEventFilename(p: EventNameParts, existing: string[]): string {
  const prefix = buildEventNamePrefix(p);
  const ext = MIME_EXT[p.mimeType];
  const seq = nextSequence(prefix, existing);
  return `${prefix}_${String(seq).padStart(3, "0")}.${ext}`;
}
