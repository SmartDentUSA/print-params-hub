import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { useTurmaWaGroup } from "@/hooks/useTurmaWaGroup";

interface Props {
  turmaId: string;
  turmaLabel?: string;
}

export function CreateTurmaWaGroupButton({ turmaId }: Props) {
  const { group, loading: checking, refetch } = useTurmaWaGroup(turmaId);
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
        await refetch();
      }
    } catch (err: any) {
      toast.error(err?.message || "Falha ao criar grupo");
    } finally {
      setLoading(false);
    }
  };

  const alreadyExists = !!group;
  const disabled = checking || alreadyExists || loading;

  const btn = (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={disabled}
      className="gap-1.5"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      {loading ? "Criando..." : "Gerar Grupo"}
    </Button>
  );

  if (alreadyExists) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><span>{btn}</span></TooltipTrigger>
          <TooltipContent>Grupo já criado{group?.nome ? `: ${group.nome}` : ""}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return btn;
}