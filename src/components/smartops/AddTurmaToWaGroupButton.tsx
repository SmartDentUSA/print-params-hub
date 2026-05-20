import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserPlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import type { TurmaWaGroup } from "@/hooks/useTurmaWaGroup";

interface Props {
  turmaId: string;
  group: TurmaWaGroup | null;
  checking: boolean;
}

export function AddTurmaToWaGroupButton({ turmaId, group, checking }: Props) {
  const [loading, setLoading] = useState(false);
  const [allAdded, setAllAdded] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!group) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("smartops-add-turma-to-wagroup", {
        body: { turma_id: turmaId },
      });
      if (error) throw error;
      const r = (data ?? {}) as {
        ok?: boolean;
        adicionados?: number;
        grupo?: string;
        erros?: number;
        erros_nomes?: string[];
        error?: string;
      };
      if (r.ok === false) {
        toast.error(r.error || "Falha ao adicionar ao grupo");
      } else {
        const grupoNome = r.grupo || group.nome || "WhatsApp";
        toast.success(`✅ ${r.adicionados ?? 0} participantes adicionados ao grupo '${grupoNome}'`);
        if ((r.erros ?? 0) > 0) {
          const nomes = (r.erros_nomes ?? []).join(", ");
          toast.warning(`⚠️ ${r.erros} números com erro${nomes ? `: ${nomes}` : ""}`);
          setAllAdded(false);
        } else {
          setAllAdded(true);
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao adicionar ao grupo");
    } finally {
      setLoading(false);
    }
  };

  const disabled = checking || !group || loading;
  const dotColor = allAdded ? "bg-emerald-500" : "bg-rose-500";
  const tooltip = !group
    ? "Crie o grupo WA primeiro"
    : allAdded
      ? "Participantes adicionados"
      : "Add membros";

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
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            </Button>
            <span className={cn("absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card", dotColor)} />
          </span>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}