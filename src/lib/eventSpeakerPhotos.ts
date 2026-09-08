import { supabase } from "@/integrations/supabase/client";

type AnySpeaker = {
  name?: string;
  instagram?: string;
  photo_url?: string;
  professional_id?: string;
  [k: string]: unknown;
};

const norm = (v?: string | null) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/**
 * As fotos dos palestrantes ficam gravadas no JSON do evento no momento do
 * agendamento. Este helper busca a foto atual do cadastro do profissional
 * (fonte usada em Cursos) e sobrescreve o snapshot, para que trocas de foto
 * apareçam imediatamente na agenda pública e na TV do estande.
 */
export async function applyFreshSpeakerPhotos<T extends AnySpeaker>(
  speakers: T[] | null | undefined,
): Promise<T[]> {
  const list = Array.isArray(speakers) ? speakers : [];
  if (list.length === 0) return list as T[];
  try {
    const { data, error } = await supabase.functions.invoke("event-speaker-booking", {
      body: { action: "professionals" },
    });
    if (error) return list as T[];
    const pros = ((data as any)?.professionals ?? []) as {
      id?: string;
      name?: string;
      photo_url?: string;
      instagram?: string;
    }[];
    if (!pros.length) return list as T[];
    const byId = new Map<string, (typeof pros)[number]>();
    const byName = new Map<string, (typeof pros)[number]>();
    for (const p of pros) {
      if (p.id) byId.set(String(p.id), p);
      if (p.name) byName.set(norm(p.name), p);
    }
    return list.map((s) => {
      const match =
        (s.professional_id ? byId.get(String(s.professional_id)) : undefined) ||
        byName.get(norm(s.name));
      if (!match) return s;
      return {
        ...s,
        photo_url: match.photo_url || s.photo_url || "",
        instagram: s.instagram || match.instagram || "",
      };
    });
  } catch {
    return list as T[];
  }
}
