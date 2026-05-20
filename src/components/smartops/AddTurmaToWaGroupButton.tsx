import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Users, Loader2 } from "lucide-react";
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
        }
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao adicionar ao grupo");
    } finally {
      setLoading(false);
    }
  };

  const disabled = checking || !group || loading;

  const btn = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled}
      className="gap-1.5"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
      {loading ? "Adicionando..." : "Add Participantes"}
    </Button>
  );

  if (!group && !checking) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><span>{btn}</span></TooltipTrigger>
          <TooltipContent>Crie o grupo WA primeiro</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return btn;
}