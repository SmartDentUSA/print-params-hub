import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FolderPlus, FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  turmaId: string;
  folderUrl?: string | null;
  onCreated?: (url: string) => void;
}

export function CriarPastaDriveButton({ turmaId, folderUrl, onCreated }: Props) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(folderUrl ?? null);
  const { toast } = useToast();

  const currentUrl = localUrl ?? folderUrl ?? null;

  const handleClick = async () => {
    if (currentUrl) {
      window.open(currentUrl, "_blank", "noopener");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("training-create-drive-folder", {
        body: { turma_id: turmaId },
      });
      if (error) throw error;
      const url = (data as any)?.folder_url as string | undefined;
      if (!url) throw new Error("Pasta criada, mas sem URL");
      setLocalUrl(url);
      onCreated?.(url);
      toast({ title: "Pasta criada no Drive", description: "Abrindo em nova aba…" });
      window.open(url, "_blank", "noopener");
    } catch (err: any) {
      toast({
        title: "Erro ao criar pasta",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("training-create-drive-folder", {
        body: { turma_id: turmaId, refresh_description: true },
      });
      if (error) throw error;
      const url = (data as any)?.folder_url as string | undefined;
      if (url && !currentUrl) setLocalUrl(url);
      toast({
        title: "Descrição atualizada no Drive",
        description: "descricao_da_imersao.txt regravado.",
      });
    } catch (err: any) {
      toast({
        title: "Erro ao atualizar descrição",
        description: err?.message || String(err),
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="inline-flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={loading}
        className="gap-1.5"
        title={currentUrl ? "Abrir pasta no Google Drive" : "Criar pasta no Google Drive"}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : currentUrl ? (
          <FolderOpen className="h-4 w-4" />
        ) : (
          <FolderPlus className="h-4 w-4" />
        )}
        {loading ? "Criando..." : currentUrl ? "Abrir Pasta" : "Criar Pasta"}
      </Button>
      {currentUrl && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Atualizar descrição no Drive"
        >
          {refreshing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}