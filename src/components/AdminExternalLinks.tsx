import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ExternalLink {
  id: string;
  name: string;
  url: string;
  keyword_type: string | null;
  search_intent: string | null;
  monthly_searches: number;
  relevance_score: number | null;
  usage_count: number;
  last_used_at: string | null;
  approved: boolean;
}

export const AdminExternalLinks = () => {
  const [links, setLinks] = useState<ExternalLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchLinks();
  }, []);

  const fetchLinks = async () => {
    try {
      const { data, error } = await supabase
        .from("external_links")
        .select("*")
        .order("relevance_score", { ascending: false });

      if (error) throw error;
      setLinks(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar keywords: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const updateRelevanceScore = async (id: string, newScore: number) => {
    try {
      const { error } = await supabase
        .from("external_links")
        .update({ relevance_score: newScore })
        .eq("id", id);

      if (error) throw error;
      toast.success("Score atualizado!");
      fetchLinks();
    } catch (error: any) {
      toast.error("Erro ao atualizar: " + error.message);
    }
  };

  const filteredLinks = links.filter((link) => {
    if (filter === "all") return true;
    if (filter === "approved") return link.approved;
    if (filter === "high-priority") return (link.relevance_score || 0) >= 70;
    return true;
  });

  if (loading) {
    return <div className="p-4">Carregando keywords...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Keywords Repository</h2>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="approved">Aprovadas</SelectItem>
            <SelectItem value="high-priority">Alta Prioridade</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Keyword</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Intenção</TableHead>
              <TableHead>Buscas/mês</TableHead>
              <TableHead>Score</TableHead>
              <TableHead>Uso</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLinks.map((link) => (
              <TableRow key={link.id}>
                <TableCell className="font-medium">
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    {link.name}
                  </a>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{link.keyword_type || "-"}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">
                    {link.search_intent || "-"}
                  </Badge>
                </TableCell>
                <TableCell>{link.monthly_searches.toLocaleString()}</TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={link.relevance_score || 0}
                    onChange={(e) =>
                      updateRelevanceScore(link.id, parseInt(e.target.value))
                    }
                    className="w-20"
                  />
                </TableCell>
                <TableCell>{link.usage_count}x</TableCell>
                <TableCell>
                  {link.approved ? (
                    <Badge variant="default">✓ Aprovada</Badge>
                  ) : (
                    <Badge variant="destructive">Pendente</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-sm text-muted-foreground">
        Total: {filteredLinks.length} keywords
      </p>
    </div>
  );
};
