import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { UploadCloud } from "lucide-react";
import { UploadMidiasDriveDialog } from "@/components/smartops/UploadMidiasDriveDialog";

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
                className="gap-1.5"
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              >
                <UploadCloud className="h-4 w-4" />
                Upload de Mídias
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {disabled ? "Crie a pasta do Drive primeiro." : "Enviar fotos e vídeos para as pastas do Drive"}
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
