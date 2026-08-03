import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TurmaDriveMediaRow {
  id: string;
  destination_key: string;
  category: string;
  enrollment_id: string | null;
  companion_id: string | null;
  participant_name_snapshot: string | null;
  participant_type: string | null;
  generated_filename: string;
  drive_web_view_link: string | null;
  status: string;
  mime_type: string;
  training_day: number | null;
}

export function useTurmaDriveMedia(turmaId: string, enabled = true) {
  return useQuery({
    queryKey: ["turma-drive-media", turmaId],
    enabled: enabled && !!turmaId,
    queryFn: async (): Promise<TurmaDriveMediaRow[]> => {
      const { data, error } = await supabase
        .from("training_drive_media")
        .select(
          "id, destination_key, category, enrollment_id, companion_id, participant_name_snapshot, participant_type, generated_filename, drive_web_view_link, status, mime_type, training_day",
        )
        .eq("turma_id", turmaId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TurmaDriveMediaRow[];
    },
  });
}

export function summarizeMedia(rows: TurmaDriveMediaRow[]) {
  const done = rows.filter((r) => r.status === "completed");
  return {
    fotos: done.filter((r) => r.destination_key.startsWith("fotos_")).length,
    videos: done.filter((r) => r.destination_key.startsWith("videos_") && r.destination_key !== "videos_depoimentos").length,
    depoimentos: done.filter((r) => r.destination_key === "videos_depoimentos").length,
  };
}
