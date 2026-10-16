import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ExternalLink } from "lucide-react";

interface PlatformStats {
  platform: string; posts: number; views: number; likes: number; comments: number; shares: number; reach: number;
}
interface SocialPost {
  id: string; platform: string; views: number | null; likes: number | null; comments: number | null;
  published_at: string | null; post_url: string | null; thumbnail_url: string | null;
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok", youtube: "YouTube", linkedin: "LinkedIn",
};
const fmtNum = (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1).replace(".", ",")}k` : String(v);
const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("pt-BR") : "—";

/** Engajamento das redes sociais: métricas dos vídeos publicados pelo pipeline de reels. */
export default function PortalSocialStats({
  call, photoUrl, profName,
}: {
  call: (action: string, extra?: Record<string, unknown>) => Promise<any>;
  photoUrl: string | null;
  profName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState<PlatformStats[]>([]);
  const [posts, setPosts] = useState<SocialPost[]>([]);

  useEffect(() => {
    let alive = true;
    call("social_stats")
      .then((d) => { if (alive) { setPlatforms(d.platforms ?? []); setPosts(d.posts ?? []); } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
  }, [call]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-3">
          {photoUrl ? (
            <img src={photoUrl} alt={profName} className="w-9 h-9 rounded-full object-cover border" />
          ) : null}
          Engajamento nas redes sociais
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : platforms.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Ainda não há publicações com métricas. Quando os vídeos dos seus cursos forem publicados nas redes,
            os números de cada rede aparecem aqui, dia a dia.
          </p>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {platforms.map((p) => {
                const eng = p.reach > 0 ? ((p.likes + p.comments + p.shares) / p.reach) * 100 : null;
                return (
                  <div key={p.platform} className="rounded-md border p-3 space-y-1">
                    <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">
                      {PLATFORM_LABEL[p.platform] ?? p.platform}
                    </p>
                    <div className="grid grid-cols-2 gap-x-3 text-xs tabular-nums">
                      <span className="text-muted-foreground">Posts: <b className="text-foreground">{p.posts}</b></span>
                      <span className="text-muted-foreground">Views: <b className="text-foreground">{fmtNum(p.views)}</b></span>
                      <span className="text-muted-foreground">Curtidas: <b className="text-foreground">{fmtNum(p.likes)}</b></span>
                      <span className="text-muted-foreground">Comentários: <b className="text-foreground">{fmtNum(p.comments)}</b></span>
                      <span className="text-muted-foreground">Alcance: <b className="text-foreground">{fmtNum(p.reach)}</b></span>
                      <span className="text-muted-foreground">Engajamento: <b className="text-foreground">{eng != null ? `${eng.toFixed(1)}%` : "—"}</b></span>
                    </div>
                  </div>
                );
              })}
            </div>
            {posts.length > 0 && (
              <div className="space-y-1.5">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Publicações recentes</p>
                <ul className="divide-y rounded-md border">
                  {posts.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                      {p.thumbnail_url && <img src={p.thumbnail_url} alt="" className="w-10 h-10 rounded object-cover border shrink-0" />}
                      <span className="font-medium">{PLATFORM_LABEL[p.platform] ?? p.platform}</span>
                      <span className="text-muted-foreground">{fmtDate(p.published_at)}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {fmtNum(p.views ?? 0)} views · {fmtNum(p.likes ?? 0)} curtidas · {fmtNum(p.comments ?? 0)} comentários
                      </span>
                      {p.post_url && (
                        <a href={p.post_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-primary hover:underline flex items-center gap-1">
                          Ver post <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
