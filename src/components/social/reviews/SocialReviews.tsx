import { useMemo, useState } from "react";
import { Star, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useGoogleConnection, useGoogleReviews, usePlacesReputation, type GoogleReview, type PlacesReview } from "./useGoogleReviews";
import { useQueryClient } from "@tanstack/react-query";

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
  const { data: connection } = useGoogleConnection();
  const { data: reviews = [], isLoading } = useGoogleReviews();
  const { data: places, isLoading: placesLoading, refetch: refetchPlaces } = usePlacesReputation();
  const [syncing, setSyncing] = useState(false);
  const qc = useQueryClient();

  async function runFirstSync() {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-google-reviews");
      if (error) throw error;
      const d = (data ?? {}) as { rating?: number; review_count?: number; reviews_synced?: number };
      toast.success(
        `Sincronização concluída — ${d.reviews_synced ?? 0} avaliações (média ${d.rating ?? 0}★ • ${d.review_count ?? 0} total)`,
      );
      await Promise.all([
        refetchPlaces(),
        qc.invalidateQueries({ queryKey: ["places-reputation"] }),
      ]);
    } catch (err) {
      toast.error(`Falha na sincronização: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSyncing(false);
    }
  }

  const [lang, setLang] = useState<"pt" | "en" | "es">("pt");
  const placesReviews: PlacesReview[] = useMemo(() => {
    if (!places) return [];
    const src =
      lang === "en" ? places.google_reviews_en
      : lang === "es" ? places.google_reviews_es
      : places.google_reviews_pt;
    return [...(src ?? [])].sort((a, b) => (b.time ?? 0) - (a.time ?? 0));
  }, [places, lang]);

  const stats = useMemo(() => ({
    total: places?.google_review_count ?? 0,
    avg: places?.google_rating ?? 0,
    lastSync: places?.last_synced_at ?? null,
  }), [places]);

  if (placesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
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
            Reputação no Google (Places API). Respostas automáticas via Business Profile API serão liberadas quando a aprovação chegar.
          </p>
      </div>

        <div className="flex gap-3">
          <Button onClick={runFirstSync} disabled={syncing} size="sm">
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {placesReviews.length === 0 ? "Executar primeira sincronização" : "Sincronizar agora"}
          </Button>
          <Card className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Total</div>
            <div className="text-lg font-semibold">{stats.total}</div>
          </Card>
          <Card className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Média</div>
            <div className="text-lg font-semibold flex items-center gap-1">
              {Number(stats.avg).toFixed(1)} <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
            </div>
          </Card>
          <Card className="px-4 py-2">
            <div className="text-xs text-muted-foreground">Última sincronização</div>
            <div className="text-sm font-medium">{fmtDate(stats.lastSync)}</div>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between gap-3">
            <span>Avaliações públicas (Places API)</span>
            <div className="flex gap-1">
              {(["pt", "en", "es"] as const).map((l) => (
                <Button
                  key={l}
                  size="sm"
                  variant={lang === l ? "default" : "outline"}
                  onClick={() => setLang(l)}
                  className="h-7 px-2 text-xs uppercase"
                >
                  {l}
                </Button>
              ))}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {placesReviews.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma avaliação carregada ainda. Clique em "Executar primeira sincronização".
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Avaliação</TableHead>
                  <TableHead className="min-w-[320px]">Mensagem</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {placesReviews.map((r, i) => (
                  <TableRow key={`${r.author_name}-${r.time}-${i}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="w-8 h-8">
                          {r.profile_photo_url && <AvatarImage src={r.profile_photo_url} alt={r.author_name ?? ""} />}
                          <AvatarFallback>{(r.author_name ?? "?").slice(0, 1).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">{r.author_name ?? "Anônimo"}</span>
                      </div>
                    </TableCell>
                    <TableCell><Stars n={r.rating} /></TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-4 max-w-xl" title={r.text ?? ""}>
                        {r.text || <span className="text-muted-foreground italic">(sem comentário)</span>}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {r.relative_time_description ?? (r.time ? fmtDate(new Date(r.time * 1000).toISOString()) : "—")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Respostas automáticas (Business Profile API)
            <Badge variant="outline">Em breve</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!connection ? (
            <div className="px-6 py-8 space-y-3 text-sm text-muted-foreground">
              <p>
                Aguardando liberação da Google Business Profile API. Quando aprovada, conecte sua conta para que a IA responda automaticamente cada nova avaliação.
              </p>
              <Button asChild variant="outline" size="sm">
                <a href={buildOAuthUrl()}>Conectar Google Business Profile</a>
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma resposta automatizada ainda. A sincronização roda a cada 3 dias após a aprovação.
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