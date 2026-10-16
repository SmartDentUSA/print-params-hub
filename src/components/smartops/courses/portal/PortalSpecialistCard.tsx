import { Button } from "@/components/ui/button";
import { MessageCircle, Users } from "lucide-react";

export interface PortalSpecialist {
  nome: string;
  photo_url: string | null;
  whatsapp: string | null;
}

/** Especialista responsável pelo KOL + atalho para o grupo de parceria no WhatsApp. */
export default function PortalSpecialistCard({
  specialist,
  groupLink,
}: {
  specialist: PortalSpecialist | null;
  groupLink?: string | null;
}) {
  if (!specialist && !groupLink) return null;
  const firstName = specialist?.nome?.split(" ")[0] ?? "";
  const waUrl = specialist?.whatsapp
    ? `https://wa.me/${specialist.whatsapp}?text=${encodeURIComponent(`Olá ${firstName}`)}`
    : null;
  const initials = (specialist?.nome ?? "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className="space-y-3 px-5 py-4 border-b">
      {specialist && (
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Especialista responsável</p>
          <div className="flex items-center gap-3">
            {specialist.photo_url ? (
              <img src={specialist.photo_url} alt={specialist.nome} className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-primary/20" />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{initials}</div>
            )}
            <div className="min-w-0 text-sm font-semibold truncate">{specialist.nome}</div>
          </div>
          {waUrl && (
            <Button asChild size="sm" className="w-full">
              <a href={waUrl} target="_blank" rel="noopener noreferrer"><MessageCircle className="mr-2 h-4 w-4" />Falar no WhatsApp</a>
            </Button>
          )}
        </div>
      )}
      {groupLink && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            <Users className="h-3.5 w-3.5" />Grupo WhatsApp parceria
          </p>
          <Button asChild size="sm" variant="outline" className="w-full">
            <a href={groupLink} target="_blank" rel="noopener noreferrer"><Users className="mr-2 h-4 w-4" />Entrar no grupo</a>
          </Button>
        </div>
      )}
    </div>
  );
}
