import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { KnowledgeVideo } from "@/hooks/useKnowledge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Video } from "lucide-react";

interface VideoSelectorProps {
  open: boolean;
  onSelect: (video: Partial<KnowledgeVideo>) => void;
  onClose: () => void;
}

// Helper: formato de duração MM:SS
const formatDuration = (seconds?: number): string => {
  if (!seconds) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Validação de URL YouTube
const isValidYoutubeUrl = (url: string): boolean => {
  if (!url) return false;
  return /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/.test(url);
};

// Helper: retorna todos os IDs de subpastas (recursivo)
const getDescendantFolderIds = (allFolders: any[], parentId: string): string[] => {
  const byParent: Record<string, string[]> = {};
  
  // Construir mapa parent_id -> child_ids
  for (const f of allFolders) {
    const p = f.parent_folder_id || null;
    if (p) {
      if (!byParent[p]) byParent[p] = [];
      byParent[p].push(String(f.pandavideo_id));
    }
  }
  
  // Busca em largura para coletar todos descendentes
  const descendants: string[] = [];
  const stack = [String(parentId)];
  
  while (stack.length) {
    const current = stack.pop()!;
    const children = byParent[current] || [];
    for (const child of children) {
      descendants.push(child);
      stack.push(child);
    }
  }
  
  return descendants;
};

export function VideoSelector({ open, onSelect, onClose }: VideoSelectorProps) {
  const [tab, setTab] = useState<"youtube" | "pandavideo">("pandavideo");
  
  // YouTube
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeTitle, setYoutubeTitle] = useState("");
  
  // PandaVideo
  const [pandaVideos, setPandaVideos] = useState<any[]>([]);
  const [folders, setFolders] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [folderFilter, setFolderFilter] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Calcular conjunto de IDs de pastas válidas (pasta selecionada + descendentes)
  const folderIdsToInclude = useMemo(() => {
    if (!folderFilter || folderFilter === 'none') return null;
    const descendants = getDescendantFolderIds(folders, folderFilter);
    return new Set([String(folderFilter), ...descendants]);
  }, [folderFilter, folders]);

  useEffect(() => {
    if (!open) return;

    const loadPandaVideoData = async () => {
      setLoading(true);
      try {
        // Carregar pastas
        const { data: foldersData } = await supabase
          .from("pandavideo_folders")
          .select("*")
          .order("name", { ascending: true });
        setFolders(foldersData || []);

        // Carregar vídeos
        const { data: videosData } = await supabase
          .from("knowledge_videos")
          .select("*")
          .eq("video_type", "pandavideo")
          .order("title", { ascending: true });
        setPandaVideos(videosData || []);
      } catch (error) {
        console.error("Erro ao carregar dados PandaVideo:", error);
      } finally {
        setLoading(false);
      }
    };

    loadPandaVideoData();
  }, [open]);

  // Filtros
  const filteredVideos = useMemo(() => {
    return pandaVideos.filter((v) => {
      // Filtro de pasta
      let matchFolder = true;
      if (folderFilter === 'none') {
        // "Sem pasta" - apenas vídeos sem folder_id
        matchFolder = !v.folder_id;
      } else if (folderFilter && folderIdsToInclude) {
        // Pasta específica - incluir pasta + todas subpastas
        matchFolder = folderIdsToInclude.has(String(v.folder_id));
      }
      // Se folderFilter é null/undefined = "Todas as pastas" = matchFolder permanece true
      
      // Filtro de busca
      const matchSearch = searchTerm
        ? (v.title || '').toLowerCase().includes(searchTerm.toLowerCase())
        : true;
      
      return matchFolder && matchSearch;
    });
  }, [pandaVideos, folderFilter, folderIdsToInclude, searchTerm]);

  const handleAdd = () => {
    if (tab === "youtube") {
      if (!youtubeUrl || !youtubeTitle || !isValidYoutubeUrl(youtubeUrl)) {
        return;
      }
      
      onSelect({
        video_type: "youtube",
        url: youtubeUrl,
        title: youtubeTitle,
        order_index: 0,
      });
      
      // Reset
      setYoutubeUrl("");
      setYoutubeTitle("");
      onClose();
      return;
    }

    if (tab === "pandavideo" && selectedVideo) {
      onSelect({
        video_type: "pandavideo",
        pandavideo_id: selectedVideo.pandavideo_id,
        pandavideo_external_id: selectedVideo.pandavideo_external_id,
        title: selectedVideo.title,
        embed_url: selectedVideo.embed_url,
        thumbnail_url: selectedVideo.thumbnail_url,
        folder_id: selectedVideo.folder_id,
        video_duration_seconds: selectedVideo.video_duration_seconds,
        description: selectedVideo.description,
        order_index: 0,
      });
      
      // Reset
      setSelectedVideo(null);
      onClose();
      return;
    }
  };

  const handleClose = () => {
    // Reset estados
    setYoutubeUrl("");
    setYoutubeTitle("");
    setSearchTerm("");
    setFolderFilter(null);
    setSelectedVideo(null);
    setTab("pandavideo");
    onClose();
  };

  const isAddDisabled = 
    tab === "youtube" 
      ? !youtubeUrl || !youtubeTitle || !isValidYoutubeUrl(youtubeUrl)
      : !selectedVideo;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Vídeo</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "youtube" | "pandavideo")} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="youtube">YouTube</TabsTrigger>
            <TabsTrigger value="pandavideo">PandaVideo</TabsTrigger>
          </TabsList>

          {/* TAB YOUTUBE */}
          <TabsContent value="youtube" className="space-y-4 flex-1">
            <div className="space-y-4">
              <div>
                <Label htmlFor="youtube-title">Título do Vídeo</Label>
                <Input
                  id="youtube-title"
                  placeholder="Ex: Como configurar a impressora 3D"
                  value={youtubeTitle}
                  onChange={(e) => setYoutubeTitle(e.target.value)}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="youtube-url">URL do YouTube</Label>
                <Input
                  id="youtube-url"
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  className="mt-1"
                />
                {youtubeUrl && !isValidYoutubeUrl(youtubeUrl) && (
                  <p className="text-sm text-destructive mt-1">
                    URL inválida. Use formato: youtube.com/watch?v=... ou youtu.be/...
                  </p>
                )}
              </div>

              {youtubeUrl && isValidYoutubeUrl(youtubeUrl) && youtubeTitle && (
                <div className="p-4 border border-border rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">Preview:</p>
                  <div className="flex items-start gap-4">
                    <Video className="w-12 h-12 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{youtubeTitle}</p>
                      <p className="text-sm text-muted-foreground">{youtubeUrl}</p>
                      <Badge variant="secondary" className="mt-2">YouTube</Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          {/* TAB PANDAVIDEO */}
          <TabsContent value="pandavideo" className="space-y-4 flex-1 flex flex-col overflow-hidden">
            {/* Filtros */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="search">Buscar por título</Label>
                <Input
                  id="search"
                  placeholder="Digite para buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="folder">Filtrar por pasta</Label>
                <Select 
                  value={folderFilter || "all"} 
                  onValueChange={(val) => setFolderFilter(val === "all" ? null : val)}
                >
                  <SelectTrigger id="folder" className="mt-1">
                    <SelectValue placeholder="Todas as pastas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as pastas</SelectItem>
                    <SelectItem value="none">Sem pasta</SelectItem>
                    {folders.map((f) => (
                      <SelectItem key={f.id} value={String(f.pandavideo_id)}>
                        {f.name} ({f.videos_count || 0})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Grid de Vídeos */}
            <ScrollArea className="h-[500px] border rounded-lg p-4">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Video className="w-16 h-16 mb-4" />
                  <p>Nenhum vídeo encontrado</p>
                  <p className="text-sm">Tente ajustar os filtros ou sincronizar vídeos</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {filteredVideos.map((v) => (
                    <div
                      key={v.id}
                      className={`border rounded-lg cursor-pointer overflow-hidden transition-all hover:shadow-lg ${
                        selectedVideo?.pandavideo_id === v.pandavideo_id
                          ? "ring-2 ring-primary shadow-lg"
                          : ""
                      }`}
                      onClick={() => setSelectedVideo(v)}
                    >
                      <div className="relative">
                        <img
                          src={v.thumbnail_url || "/placeholder.svg"}
                          alt={v.title}
                          className="w-full h-36 object-cover"
                        />
                        {v.video_duration_seconds && (
                          <Badge 
                            variant="secondary" 
                            className="absolute bottom-2 right-2 bg-black/80 text-white"
                          >
                            {formatDuration(v.video_duration_seconds)}
                          </Badge>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="text-sm font-medium line-clamp-2">
                          {v.title}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Preview do Vídeo Selecionado */}
            {selectedVideo && (
              <div className="border border-primary rounded-lg p-4 bg-primary/5">
                <p className="text-sm font-semibold mb-3 text-primary">Vídeo Selecionado:</p>
                <div className="flex gap-4">
                  <img
                    src={selectedVideo.thumbnail_url || "/placeholder.svg"}
                    alt={selectedVideo.title}
                    className="w-32 h-20 object-cover rounded border border-border"
                  />
                  <div className="flex-1">
                    <p className="font-medium">{selectedVideo.title}</p>
                    {selectedVideo.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                        {selectedVideo.description}
                      </p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <Badge variant="secondary">PandaVideo</Badge>
                      {selectedVideo.video_duration_seconds && (
                        <Badge variant="outline">
                          {formatDuration(selectedVideo.video_duration_seconds)}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleAdd} disabled={isAddDisabled}>
            Adicionar Vídeo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
