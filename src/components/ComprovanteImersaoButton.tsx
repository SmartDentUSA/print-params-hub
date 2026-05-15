import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileSignature, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Props {
  enrollmentId: string;
  companionId?: string;
  personName?: string;
  turmaLabel?: string;
}

export function ComprovanteImersaoButton({
  enrollmentId,
  companionId,
  personName,
  turmaLabel,
}: Props) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGerar = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão inválida");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const params = new URLSearchParams({ enrollment_id: enrollmentId });
      if (companionId) params.set("companion_id", companionId);
      const url = `${supabaseUrl}/functions/v1/smartops-gerar-comprovante-imersao?${params.toString()}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro ao gerar comprovante");
      }

      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const safeName = (personName || "participante").replace(/[^a-zA-Z0-9]+/g, "_");
      const safeTurma = (turmaLabel || "turma").replace(/[^a-zA-Z0-9]+/g, "_");
      link.download = `comprovante_${safeName}_${safeTurma}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({ title: "Comprovante gerado", description: "Download iniciado." });
    } catch (err: any) {
      toast({
        title: "Erro ao gerar comprovante",
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
            variant="ghost"
            size="sm"
            onClick={handleGerar}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileSignature className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>Gerar comprovante de imersão (.docx)</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}