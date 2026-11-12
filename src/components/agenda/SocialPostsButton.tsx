import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, Instagram, Loader2 } from "lucide-react";
import { call } from "./CrmInsertionButton";
import { CouponLine } from "./CreativesButton";
import { SellerMessageBox } from "./SellerMessageBox";

type Post = {
  id: string; link: string; cover_url: string | null; published_at: string | null; caption: string;
  message: string; default_message: string; edited: boolean;
};
type Resp = {
  table: { id: string; name: string } | null; hashtags: string[];
  coupon: { code: string; valid_until: string | null } | null; posts: Post[];
};

function PostItem({ p, tableId }: { p: Post; tableId: string }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["agenda-social-posts"] });
  return (
    <div className="flex flex-col gap-3 rounded-md border p-3">
      <div className="grid grid-cols-[120px_1fr] gap-3">
        {p.cover_url
          ? <img src={p.cover_url} alt="Publicação do Instagram" className="aspect-square w-full rounded bg-muted object-cover" loading="lazy" referrerPolicy="no-referrer" />
          : <div className="flex aspect-square w-full items-center justify-center rounded bg-muted text-muted-foreground"><Instagram className="h-6 w-6" /></div>}
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{p.published_at ? `Publicado em ${new Date(p.published_at).toLocaleDateString("pt-BR")}` : "Publicação"}</p>
          <p className="line-clamp-4 whitespace-pre-line text-sm">{p.caption || "—"}</p>
          {p.link && <Button asChild size="sm" variant="outline"><a href={p.link} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir publicação</a></Button>}
        </div>
      </div>
      <SellerMessageBox
        message={p.message} defaultMessage={p.default_message} edited={p.edited}
        placeholder="A mensagem desta publicação está sendo preparada. Feche e abra de novo em instantes."
        onSave={async (message) => { await call("social_save_message", { table_id: tableId, post_id: p.id, message }); refresh(); }}
        onReset={async () => { await call("social_reset_message", { table_id: tableId, post_id: p.id }); refresh(); }}
      />
    </div>
  );
}

export function SocialPostsButton() {
  const [open, setOpen] = useState(false);
  const q = useQuery({ queryKey: ["agenda-social-posts"], queryFn: () => call<Resp>("social_posts"), enabled: open, staleTime: 60_000 });
  const d = q.data;
  return (
    <>
      <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto" onClick={() => setOpen(true)}><Instagram className="h-4 w-4" /> Social posts</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Instagram className="h-5 w-5 text-primary" /> Social posts da campanha</DialogTitle>
            <DialogDescription>
              {d?.table ? <>{d.table.name}{d.hashtags.length ? ` · ${d.hashtags.map((t) => `#${t}`).join(" ")}` : ""}</> : "Publicações do Instagram da tabela vigente"}
            </DialogDescription>
          </DialogHeader>
          {q.isLoading ? <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando publicações e preparando mensagens…</p>
            : q.isError ? <p className="py-6 text-sm text-destructive">{(q.error as Error).message}</p>
            : !d?.table ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma tabela vigente no momento.</p>
            : !d.hashtags.length ? <p className="py-6 text-center text-sm text-muted-foreground">A tabela vigente ainda não tem hashtag de campanha.</p>
            : (
              <div className="space-y-3">
                <CouponLine coupon={d.coupon} />
                {!d.posts.length ? <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma publicação do Instagram com {d.hashtags.map((t) => `#${t}`).join(" ou ")} ainda.</p>
                  : <div className="grid gap-3 md:grid-cols-2">{d.posts.map((p) => <PostItem key={p.id} p={p} tableId={d.table!.id} />)}</div>}
              </div>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
