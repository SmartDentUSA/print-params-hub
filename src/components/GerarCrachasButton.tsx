import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { IdCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  turmaId: string;
  turmaLabel?: string;
}

export function GerarCrachasButton({ turmaId, turmaLabel }: Props) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGerar = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão inválida");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/smartops-gerar-crachas-turma?turma_id=${turmaId}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro ao gerar crachás");
      }

      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const safeName = (turmaLabel || turmaId).replace(/[^a-zA-Z0-9]/g, "_");
      link.download = `crachas_${safeName}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({ title: "Crachás gerados!", description: "Download iniciado." });
    } catch (err: any) {
      toast({
        title: "Erro ao gerar crachás",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={handleGerar}
            disabled={loading}
            className="h-8 w-8"
            aria-label="Gerar crachás"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <IdCard className="h-4 w-4" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Gerar crachás (PDF dobrável)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}