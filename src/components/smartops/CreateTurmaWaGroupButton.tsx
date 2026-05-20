import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { TurmaWaGroup } from "@/hooks/useTurmaWaGroup";

interface Props {
  turmaId: string;
  group: TurmaWaGroup | null;
  checking: boolean;
  onCreated: () => void | Promise<void>;
}

export function CreateTurmaWaGroupButton({ turmaId, group, checking, onCreated }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (group) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smartops-create-turma-wagroup", {
        body: { turma_id: turmaId },
      });
      if (error) throw error;
      const r = (data ?? {}) as { ok?: boolean; grupo?: string; error?: string };
      if (r.ok === false) {
        toast.error(r.error || "Falha ao criar grupo");
      } else {
        toast.success(`✅ Grupo '${r.grupo ?? "WhatsApp"}' criado`);
        await onCreated();
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao criar grupo");
    } finally {
      setLoading(false);
    }
  };

  const alreadyExists = !!group;
  const disabled = checking || alreadyExists || loading;
  const dotColor = alreadyExists ? "bg-emerald-500" : "bg-rose-500";
  const tooltip = alreadyExists
    ? `Grupo já criado${group?.nome ? `: ${group.nome}` : ""}`
    : "Criar grupo WA";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="relative inline-flex">
            <Button
              variant="outline"
              size="icon"
              onClick={handleClick}
              disabled={disabled}
              className="h-8 w-8"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
            </Button>
            <span className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card", dotColor)} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}