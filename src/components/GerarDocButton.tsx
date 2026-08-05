import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface GerarDocButtonProps {
  turmaId: string;
  turmaLabel?: string;
}

export function GerarDocButton({ turmaId, turmaLabel }: GerarDocButtonProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGerar = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão inválida");

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const url = `${supabaseUrl}/functions/v1/smartops-gerar-doc-turma?turma_id=${turmaId}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || "Erro ao gerar documento");
      }

      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      const safeName = (turmaLabel || turmaId).replace(/[^a-zA-Z0-9]/g, "_");
      link.download = `imersao_${safeName}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({ title: "Documento gerado!", description: "Download iniciado." });
    } catch (err: any) {
      toast({
        title: "Erro ao gerar documento",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleGerar}
      disabled={loading}
      className="h-7 gap-1 px-2 text-xs"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FileText className="h-3.5 w-3.5" />
      )}
      {loading ? "Gerando..." : "Gerar Doc"}
    </Button>
  );
}