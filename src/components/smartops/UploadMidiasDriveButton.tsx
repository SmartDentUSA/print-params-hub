import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { UploadCloud } from "lucide-react";
import { UploadMidiasDriveDialog } from "@/components/smartops/UploadMidiasDriveDialog";
import { useTurmaDriveInventory } from "@/hooks/useTurmaDriveInventory";
import { TURMA_MEDIA_TARGET, isGoalReached } from "@/lib/trainingMediaTargets";
import { cn } from "@/lib/utils";

interface Props {
  turmaId: string;
  turmaNumber?: number | null;
  turmaLabel?: string;
  courseTitle?: string;
  startDate?: string | null;
  endDate?: string | null;
  folderId?: string | null;
  folderUrl?: string | null;
}

export function UploadMidiasDriveButton({
  turmaId, turmaNumber, turmaLabel, courseTitle, startDate, endDate, folderId, folderUrl,
}: Props) {
  const [open, setOpen] = useState(false);
  const disabled = !folderId;
  const { data: inventory } = useTurmaDriveInventory(turmaId, !!folderId);

  const sent = useMemo(
    () => Object.values(inventory?.counts || {}).reduce((sum, n) => sum + (Number(n) || 0), 0),
    [inventory],
  );
  const complete = isGoalReached(sent, TURMA_MEDIA_TARGET);

  return (
    <>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                disabled={disabled}
                className="h-7 gap-1 px-2 text-xs"
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              >
                <UploadCloud className="h-3.5 w-3.5" />
                Upload de Mídias
                {!disabled && inventory && (
                  <>
                    <span
                      className={cn(
                        "ml-1 h-2 w-2 rounded-full",
                        complete ? "bg-emerald-500" : sent > 0 ? "bg-amber-500" : "bg-muted-foreground/30",
                      )}
                    />
                    <Badge
                      variant="outline"
                      className={cn("ml-0.5 h-4 px-1 font-mono text-[10px]", complete && "border-emerald-500/50 text-emerald-600")}
                    >
                      {sent}/{TURMA_MEDIA_TARGET}
                    </Badge>
                  </>
                )}
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {disabled
              ? "Crie a pasta do Drive primeiro."
              : complete
                ? `Meta de mídias atingida (${sent} arquivos no Drive)`
                : `${sent} de ${TURMA_MEDIA_TARGET} mídias enviadas — enviar fotos e vídeos`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {open && (
        <div onClick={(e) => e.stopPropagation()}>
          <UploadMidiasDriveDialog
            open={open}
            onOpenChange={setOpen}
            turmaId={turmaId}
            turmaNumber={turmaNumber ?? null}
            turmaLabel={turmaLabel}
            courseTitle={courseTitle}
            startDate={startDate ?? null}
            endDate={endDate ?? null}
            folderUrl={folderUrl ?? null}
          />
        </div>
      )}
    </>
  );
}
