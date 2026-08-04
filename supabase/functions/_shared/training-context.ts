// Contexto de produção de conteúdo de uma turma de treinamento.
// Usado pela API de leitura do agente (GPT SmartOps – Marketing Treinamentos)
// e pelo endpoint de entregáveis. Somente dados reais do banco — nada inventado.

export interface TrainingStage {
  day_number: number | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  topic: string | null;
}

export interface TrainingContext {
  turma: {
    id: string;
    turma_number: number | null;
    label: string | null;
    start_date: string | null;
    end_date: string | null;
    location: string | null;
    modality: string | null;
    drive_folder_id: string | null;
    drive_folder_url: string | null;
    drive_subfolders: Record<string, string>;
  };
  course: {
    id: string | null;
    title: string | null;
    slug: string | null;
    description: string | null;
    duration_days: number | null;
    related_product_names: string[];
  };
  stages: TrainingStage[];
  equipment: string[];
  participants: {
    total: number;
    with_instagram: number;
    instagram_handles: string[];
    cities: string[];
    states: string[];
    specialties: string[];
    areas: string[];
  };
}

/** @handle sem URL, sem espaços, minúsculo. */
export function normalizeInstagram(raw?: string | null): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  const cleaned = s
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .toLowerCase();
  if (!cleaned || !/^[a-z0-9._]{2,30}$/.test(cleaned)) return null;
  return `@${cleaned}`;
}

function uniqStrings(values: unknown[], limit = 40): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length >= limit) break;
  }
  return out;
}

/** Extrai rótulos de equipamento de `equipment_data` (JSONB livre). */
function equipmentLabels(equipmentData: any): string[] {
  const out: string[] = [];
  const walk = (node: any, depth = 0) => {
    if (node == null || depth > 3) return;
    if (typeof node === "string") {
      const s = node.trim();
      if (s && s.length <= 80 && !/^\d+$/.test(s)) out.push(s);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (!/(marca|modelo|brand|model|impressora|printer|scanner|equipamento|software)/i.test(k)) continue;
        walk(v, depth + 1);
      }
    }
  };
  walk(equipmentData);
  return out;
}

export async function loadTrainingContext(db: any, turma: any): Promise<TrainingContext> {
  const courseId = turma?.course_id ?? null;

  const [courseRes, daysRes, enrollRes] = await Promise.all([
    courseId
      ? db
          .from("smartops_courses")
          .select("id, title, slug, description, duration_days, related_product_names")
          .eq("id", courseId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    db
      .from("smartops_turma_days")
      .select("day_number, date, start_time, end_time, topic")
      .eq("turma_id", turma.id)
      .order("day_number", { ascending: true }),
    db
      .from("smartops_course_enrollments")
      .select("id, status, instagram, empresa_cidade, empresa_estado, especialidade, area_atuacao, equipment_data")
      .eq("turma_id", turma.id),
  ]);

  const course = (courseRes as any)?.data || null;
  const stages: TrainingStage[] = ((daysRes as any)?.data || []).map((d: any) => ({
    day_number: d.day_number ?? null,
    date: d.date ?? null,
    start_time: d.start_time ?? null,
    end_time: d.end_time ?? null,
    topic: d.topic ?? null,
  }));

  const blocked = ["cancelado", "cancelada", "no_show", "invalido"];
  const enrolls = ((enrollRes as any)?.data || []).filter(
    (e: any) => !blocked.includes(String(e.status || "").toLowerCase()),
  );

  const handles = uniqStrings(enrolls.map((e: any) => normalizeInstagram(e.instagram)).filter(Boolean));
  const equipment = uniqStrings(enrolls.flatMap((e: any) => equipmentLabels(e.equipment_data)), 25);

  const relatedRaw = String(course?.related_product_names || "");
  const relatedProducts = uniqStrings(relatedRaw.split(/[;,\n|]/), 20);

  return {
    turma: {
      id: turma.id,
      turma_number: turma.turma_number ?? null,
      label: turma.label ?? null,
      start_date: turma.start_date ?? null,
      end_date: turma.end_date ?? null,
      location: turma.location ?? null,
      modality: turma.modality ?? null,
      drive_folder_id: turma.drive_folder_id ?? null,
      drive_folder_url: turma.drive_folder_url ?? null,
      drive_subfolders: (turma.drive_subfolders || {}) as Record<string, string>,
    },
    course: {
      id: course?.id ?? courseId,
      title: course?.title ?? turma?.smartops_courses?.title ?? null,
      slug: course?.slug ?? null,
      description: course?.description ?? null,
      duration_days: course?.duration_days ?? turma?.smartops_courses?.duration_days ?? null,
      related_product_names: relatedProducts,
    },
    stages,
    equipment,
    participants: {
      total: enrolls.length,
      with_instagram: handles.length,
      instagram_handles: handles,
      cities: uniqStrings(enrolls.map((e: any) => e.empresa_cidade)),
      states: uniqStrings(enrolls.map((e: any) => e.empresa_estado)),
      specialties: uniqStrings(enrolls.map((e: any) => e.especialidade)),
      areas: uniqStrings(enrolls.map((e: any) => e.area_atuacao)),
    },
  };
}