import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Eye, Link as LinkIcon, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shortenUrl } from "@/utils/shortLink";
import type { BioPage } from "@/hooks/useBioPages";
import { isBioPageVisit } from "@/lib/bioMetrics";

type Counts = { view: number; card_click: number; cta_click: number; whatsapp_click: number };
const zero = (): Counts => ({ view: 0, card_click: 0, cta_click: 0, whatsapp_click: 0 });

function useBioStats(pageId: string, slug: string) {
  return useQuery({
    queryKey: ["bio-stats", pageId, slug, "historical"],
    queryFn: async () => {
      const total = zero();
      const perItem: Record<string, Counts> = {};
      for (let from = 0; ; from += 1000) {
        const { data, error } = await (supabase as any)
          .from("smartops_bio_events")
          .select("item_id,event_type")
          .eq("page_id", pageId)
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        for (const r of data ?? []) {
          const t = r.event_type as keyof Counts;
          if (!(t in total) || t === "view") continue;
          total[t]++;
          if (r.item_id) (perItem[r.item_id] ??= zero())[t]++;
        }
        if (!data || data.length < 1000) break;
      }
      // Page tracking already covers historical and new visits: never add Bio
      // view events to it, because a single opening writes to both tables.
      for (let from = 0; ; from += 1000) {
        const { data: visits, error } = await supabase
          .from("lead_page_views")
          .select("page_path")
          .ilike("page_path", `%/bio/${slug}%`)
          .order("id")
          .range(from, from + 999);
        if (error) throw error;
        total.view += (visits ?? []).filter((visit) => isBioPageVisit(visit.page_path, slug)).length;
        if (!visits || visits.length < 1000) break;
      }
      return { total, perItem };
    },
    refetchInterval: 60_000,
  });
}

export function BioShortLink({ url }: { url: string }) {
  const [short, setShort] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    shortenUrl(url).then((s) => alive && setShort(s));
    return () => { alive = false; };
  }, [url]);
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <LinkIcon className="h-3 w-3 text-primary" />
      {short ? <span className="font-mono text-foreground">{short}</span> : <Loader2 className="h-3 w-3 animate-spin" />}
      {short && (
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(short); toast.success("Link curto copiado"); }} aria-label="Copiar link curto">
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

export function BioPageStats({ page }: { page: BioPage }) {
  const { data, isLoading, isError } = useBioStats(page.id, page.slug);
  const [open, setOpen] = useState(false);
  const t = data?.total ?? zero();
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1"><Eye className="h-3.5 w-3.5" /><b className="text-foreground">{isLoading ? "…" : isError ? "—" : t.view}</b> acessos à página</span>
        <span><b className="text-foreground">{isError ? "—" : t.card_click}</b> cliques no card</span>
        <span><b className="text-foreground">{isError ? "—" : t.cta_click}</b> Saiba mais</span>
        <span><b className="text-foreground">{isError ? "—" : t.whatsapp_click}</b> Especialista</span>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="h-7 text-xs">
            Cards <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
      </div>
      {isError && <p className="mt-2 text-xs text-destructive">Não foi possível consultar as contagens.</p>}
      <CollapsibleContent>
        <div className="mt-2 overflow-x-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-2 text-left">Card</th>
                <th className="p-2 text-right">Clicks no card</th>
                <th className="p-2 text-right">Clicks no Saiba mais</th>
                <th className="p-2 text-right">Clicks no Falar com um Especialista</th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((it) => {
                const c = data?.perItem[it.id] ?? zero();
                return (
                  <tr key={it.id} className="border-t border-border">
                    <td className="p-2">{it.label}</td>
                    <td className="p-2 text-right">{c.card_click}</td>
                    <td className="p-2 text-right">{c.cta_click}</td>
                    <td className="p-2 text-right">{c.whatsapp_click}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="p-2 text-[11px] text-muted-foreground">Acessos incluem o histórico da página. Cliques anteriores à correção do rastreamento não estão disponíveis.</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
