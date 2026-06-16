import { useMemo, useState } from "react";
import { Star, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGoogleConnection, useGoogleReviews, type GoogleReview } from "./useGoogleReviews";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-oauth-callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "openid",
  "email",
].join(" ");

function buildOAuthUrl() {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function Stars({ n }: { n: number | null }) {
  const count = n ?? 0;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < count ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

function StatusBadge({ r }: { r: GoogleReview }) {
  if (r.response_status === "published") return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">✅ Publicado</Badge>;
  if (r.response_status === "pending") return <Badge variant="secondary">⏳ Gerando…</Badge>;
  if (r.response_status === "error") return <Badge variant="destructive" title={r.error_message ?? undefined}>⚠️ Erro</Badge>;
  return <Badge variant="outline">{r.response_status}</Badge>;
}

export function SocialReviews() {
  const { data: connection, isLoading: connLoading } = useGoogleConnection();
  const { data: reviews = [], isLoading } = useGoogleReviews();
  const [syncing, setSyncing] = useState(false);

  async function runFirstSync() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-reviews-pull");
      if (error) throw error;
      const d = (data ?? {}) as { new_reviews?: number; updated?: number; errors?: number };
      toast.success(
        `Sincronização concluída — novos: ${d.new_reviews ?? 0}, atualizados: ${d.updated ?? 0}, erros: ${d.errors ?? 0}`,
      );
    } catch (err) {
      toast.error(`Falha na sincronização: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  const stats = useMemo(() => {
    if (!reviews.length) return { total: 0, avg: 0, lastSync: null as string | null };
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + (r.star_rating ?? 0), 0);
    const avg = sum / total;
    const lastSync = reviews
      .map((r) => r.reply_time ?? r.create_time)
      .filter(Boolean)
      .sort()
      .reverse()[0] ?? null;
    return { total, avg, lastSync };
  }, [reviews]);

  if (connLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!connection) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-6">
        <Card className="max-w-lg w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" /> Avaliações Google
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Conecte o Google Business Profile para que a IA responda automaticamente,
              a cada 3 dias, todas as novas avaliações da sua empresa no Google.
              Não há ações manuais — tudo roda sozinho.
            </p>
            <Button asChild className="w-full" size="lg">
              <a href={buildOAuthUrl()}>Conectar Google Business Profile</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500" /> Avaliações Google
          </h1>
          <p className="text-sm text-muted-foreground">
            Histórico de avaliações e respostas publicadas automaticamente pela IA.
          </p>
        </div>
        <div className="flex gap-3">
          {reviews.length === 0 && !isLoading && (
            <Button onClick={runFirstSync} disabled={syncing} size="sm">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              Executar primeira sincronização
            </Button>
          )}
          <Card className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-semibold">{stats.total}</div>
          </Card>
          <Card className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Média</div>
            <div className="text-lg font-semibold flex items-center gap-1">
              {stats.avg.toFixed(1)} <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Última sincronização</div>
            <div className="text-sm font-medium">{fmtDate(stats.lastSync)}</div>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma avaliação ainda. A sincronização automática roda a cada 3 dias.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead className="min-w-[240px]">Mensagem</TableHead>
                  <TableHead className="min-w-[280px]">Resposta publicada</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data avaliação</TableHead>
                  <TableHead>Data resposta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          {r.reviewer_photo_url && <AvatarImage src={r.reviewer_photo_url} alt={r.reviewer_name ?? ""} />}
                          <AvatarFallback>{(r.reviewer_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{r.reviewer_name ?? "Anônimo"}</span>
                      </div>
                    </TableCell>
                    <TableCell><Stars n={r.star_rating} /></TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-3 max-w-md" title={r.comment ?? ""}>
                        {r.comment || <span className="text-muted-foreground italic">(sem comentário)</span>}
                      </p>
                    </TableCell>
                    <TableCell>
                      {r.reply_text ? (
                        <p className="text-sm line-clamp-3 max-w-md text-muted-foreground" title={r.reply_text}>
                          {r.reply_text}
                        </p>
                      ) : r.response_status === "pending" ? (
                        <span className="text-xs text-muted-foreground">⏳ Gerando resposta…</span>
                      ) : r.response_status === "error" ? (
                        <span className="text-xs text-destructive" title={r.error_message ?? undefined}>
                          {r.error_message ?? "Erro ao gerar"}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell><StatusBadge r={r} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(r.create_time)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{fmtDate(r.reply_time)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}