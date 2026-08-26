import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UploadMidiasDriveButton } from "@/components/smartops/UploadMidiasDriveButton";
import { formatTurmaNumber } from "@/lib/turmaNumber";
import { formatDatePtBr } from "@/lib/courseUtils";

interface PastTurma {
  id: string;
  course_id: string;
  turma_number: number | null;
  label: string | null;
  course_title: string | null;
  start_date: string | null;
  end_date: string | null;
  end_time: string | null;
  modality: string | null;
}

const GRACE_MS = 12 * 60 * 60 * 1000;

/**
 * Treinamentos já realizados: permite ao time enviar fotos/vídeos depois do evento,
 * abrindo o mesmo modal de upload usado nos cards de curso.
 */
export function PastTrainingsUploadAccordion({ modalities }: { modalities: string[] }) {
  const [search, setSearch] = useState("");

  const { data: turmas = [], isLoading } = useQuery({
    queryKey: ["agenda_past_turmas", modalities.join(",")],
    staleTime: 60_000,
    queryFn: async (): Promise<PastTurma[]> => {
      const { data, error } = await (supabase as any)
        .from("v_turmas_com_vagas")
        .select("id, course_id, turma_number, label, course_title, start_date, end_date, end_time, modality")
        .eq("active", true)
        .in("modality", modalities)
        .order("start_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as PastTurma[];
    },
  });

  const { data: driveFolders = {} } = useQuery({
    queryKey: ["agenda_past_drive_folders"],
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, { id: string | null; url: string | null }>> => {
      const { data, error } = await (supabase as any).rpc("fn_agenda_drive_folders");
      if (error) throw error;
      const map: Record<string, { id: string | null; url: string | null }> = {};
      for (const r of (data ?? []) as any[]) map[r.turma_id] = { id: r.folder_id ?? null, url: r.folder_url ?? null };
      return map;
    },
  });

  const past = useMemo(() => {
    const nowMs = Date.now();
    const term = search.trim().toLowerCase();
    return turmas
      .filter((t) => {
        const endDate = t.end_date || t.start_date;
        if (!endDate) return false;
        const endMs = new Date(`${endDate}T${(t.end_time || "23:59").substring(0, 5)}:00`).getTime();
        return Number.isFinite(endMs) && endMs + GRACE_MS <= nowMs;
      })
      .filter((t) => {
        if (!term) return true;
        const hay = `${t.course_title ?? ""} ${t.label ?? ""} ${t.turma_number ?? ""} ${t.start_date ?? ""}`.toLowerCase();
        return hay.includes(term);
      });
  }, [turmas, search]);

  return (
    <Accordion type="single" collapsible className="mb-6 rounded-xl border bg-card">
      <AccordionItem value="past-uploads" className="border-0">
        <AccordionTrigger className="px-4 py-3 hover:no-underline">
          <span className="flex flex-col items-start gap-0.5 text-left">
            <span className="flex items-center gap-2 text-sm font-semibold">
              <History className="h-4 w-4 text-muted-foreground" />
              Upload de mídias — treinamentos realizados
              {!!past.length && <Badge variant="secondary">{past.length}</Badge>}
            </span>
            <span className="pl-6 text-[11px] font-normal text-muted-foreground">
              Visível apenas para team members logados (inclui login por celular)
            </span>
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por curso, turma ou data…"
              className="pl-9"
            />
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando treinamentos realizados…</p>
          ) : past.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum treinamento realizado encontrado.</p>
          ) : (
            <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
              {past.map((t) => {
                const folder = driveFolders[t.id];
                return (
                  <div
                    key={t.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {t.course_title || t.label || "Treinamento"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t.turma_number ? `${formatTurmaNumber(t.turma_number)} · ` : ""}
                        {formatDatePtBr(t.start_date || "")}
                        {t.end_date && t.end_date !== t.start_date ? ` a ${formatDatePtBr(t.end_date)}` : ""}
                      </p>
                    </div>
                    <UploadMidiasDriveButton
                      turmaId={t.id}
                      turmaNumber={t.turma_number}
                      turmaLabel={t.label ?? undefined}
                      courseTitle={t.course_title ?? undefined}
                      startDate={t.start_date}
                      endDate={t.end_date}
                      folderId={folder?.id ?? null}
                      folderUrl={folder?.url ?? null}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
