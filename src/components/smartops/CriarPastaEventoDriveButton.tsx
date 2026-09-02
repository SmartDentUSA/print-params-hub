import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { FolderPlus, FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  eventId: string;
  folderUrl?: string | null;
  onCreated?: (url: string) => void;
}

export function CriarPastaEventoDriveButton({ eventId, folderUrl, onCreated }: Props) {
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
      const { data, error } = await supabase.functions.invoke("event-create-drive-folder", {
        body: { event_id: eventId },
      });
      if (error) throw error;
      const url = (data as any)?.folder_url as string | undefined;
      if (!url) throw new Error("Pasta criada, mas sem URL");
      setLocalUrl(url);
      onCreated?.(url);
      toast({ title: "Pasta do evento criada no Drive", description: "Abrindo em nova aba…" });
      window.open(url, "_blank", "noopener");
    } catch (err: any) {
      toast({ title: "Erro ao criar pasta", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("event-create-drive-folder", {
        body: { event_id: eventId, refresh_description: true },
      });
      if (error) throw error;
      const url = (data as any)?.folder_url as string | undefined;
      if (url && !currentUrl) setLocalUrl(url);
      toast({
        title: "Estrutura e descritivo atualizados",
        description: "Subpastas conferidas e descritivo_do_evento (JSON + DOCX) regravado.",
      });
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err?.message || String(err), variant: "destructive" });
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
        className="h-7 gap-1 px-2 text-xs"
        title={currentUrl ? "Abrir pasta do evento no Google Drive" : "Criar pasta do evento no Google Drive"}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : currentUrl ? (
          <FolderOpen className="h-3.5 w-3.5" />
        ) : (
          <FolderPlus className="h-3.5 w-3.5" />
        )}
        {loading ? "Criando..." : currentUrl ? "Abrir Pasta" : "Criar Pasta"}
      </Button>
      {currentUrl && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleRefresh}
          disabled={refreshing}
          title="Reconferir subpastas e atualizar descritivo"
        >
          {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      )}
    </div>
  );
}
