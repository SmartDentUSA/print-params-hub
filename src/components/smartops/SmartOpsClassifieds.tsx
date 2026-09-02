import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  CheckCircle2, Eye, Flag, Loader2, MessageCircle, RefreshCw, Send, ShieldOff, XCircle,
} from "lucide-react";
import {
  CLASSIFIED_STATUS_LABEL, categoryLabel, conditionLabel, formatPrice, imageList, listingUrl,
} from "@/lib/classifieds";

interface AdminListing {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  price: number | null;
  condition: string | null;
  category: string | null;
  location_city: string | null;
  location_state: string | null;
  images: unknown;
  status: string;
  auto_approved: boolean | null;
  reviewed_at: string | null;
  contact_whatsapp: string | null;
  view_count: number | null;
  wa_click_count: number | null;
  wa_dispatched_at: string | null;
  created_at: string;
  lead_id: string | null;
}

interface ReportRow {
  id: string;
  listing_id: string;
  reason: string;
  details: string | null;
  created_at: string;
  resolved_at: string | null;
}

const SELECT =
  "id, slug, title, description, price, condition, category, location_city, location_state, images, status, auto_approved, reviewed_at, contact_whatsapp, view_count, wa_click_count, wa_dispatched_at, created_at, lead_id";

export default function SmartOpsClassifieds() {
  const { toast } = useToast();
  const [tab, setTab] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<AdminListing[]>([]);
  const [autoReview, setAutoReview] = useState<AdminListing[]>([]);
  const [active, setActive] = useState<AdminListing[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const base = () => (supabase as any).from("classified_listings").select(SELECT).eq("type", "equipment");
    const [p, a, ac, r] = await Promise.all([
      base().eq("status", "pending").order("created_at", { ascending: true }),
      base().eq("status", "active").eq("auto_approved", true).is("reviewed_at", null).order("created_at", { ascending: false }),
      base().eq("status", "active").order("published_at", { ascending: false }).limit(60),
      (supabase as any).from("classified_reports").select("*").is("resolved_at", null).order("created_at", { ascending: false }),
    ]);
    setPending((p.data ?? []) as AdminListing[]);
    setAutoReview((a.data ?? []) as AdminListing[]);
    setActive((ac.data ?? []) as AdminListing[]);
    setReports((r.data ?? []) as ReportRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function moderate(listingId: string, action: string, extra?: Record<string, unknown>) {
    setBusy(listingId + action);
    const { data, error } = await supabase.functions.invoke("classifieds-moderate", {
      body: { listing_id: listingId, action, ...extra },
    });
    setBusy(null);
    const payload = data as { error?: string } | null;
    if (error || payload?.error) {
      toast({ title: "Falha na moderação", description: payload?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Feito" });
    load();
  }

  async function dispatchWa(listingId: string) {
    setBusy(listingId + "wa");
    const { data, error } = await supabase.functions.invoke("classifieds-dispatch-wa", {
      body: { listing_id: listingId, force: true },
    });
    setBusy(null);
    const payload = data as { ok?: boolean; skipped?: string; groups?: number } | null;
    if (error) { toast({ title: "Falha no disparo", variant: "destructive" }); return; }
    toast({
      title: payload?.ok ? `Enviado para ${payload.groups} grupos` : "Não enviado",
      description: payload?.skipped,
    });
    load();
  }

  function ListingCard({ l, mode }: { l: AdminListing; mode: "pending" | "review" | "active" }) {
    const cover = imageList(l.images)[0];
    const listingReports = reports.filter((r) => r.listing_id === l.id);
    return (
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex gap-3">
            <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
              {cover && <img src={cover} alt={l.title} className="h-full w-full object-cover" />}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{categoryLabel(l.category)}</Badge>
                <Badge variant="outline">{conditionLabel(l.condition)}</Badge>
                <Badge variant={l.status === "active" ? "default" : "secondary"}>
                  {CLASSIFIED_STATUS_LABEL[l.status] ?? l.status}
                </Badge>
                {l.auto_approved && <Badge className="bg-emerald-600 text-white">Auto-aprovado</Badge>}
                {listingReports.length > 0 && (
                  <Badge variant="destructive">
                    <Flag className="mr-1 h-3 w-3" />{listingReports.length} denúncia(s)
                  </Badge>
                )}
              </div>
              <p className="text-sm font-semibold">{l.title}</p>
              <p className="text-sm font-bold text-primary">{formatPrice(l.price)}</p>
              <p className="text-xs text-muted-foreground">
                {[l.location_city, l.location_state].filter(Boolean).join("/") || "sem localização"} ·{" "}
                {l.contact_whatsapp || "sem WhatsApp"} · {new Date(l.created_at).toLocaleString("pt-BR")}
              </p>
              <p className="text-xs text-muted-foreground">
                {l.view_count ?? 0} views · {l.wa_click_count ?? 0} contatos ·{" "}
                {l.wa_dispatched_at ? "disparado em grupos" : "não disparado"}
              </p>
            </div>
          </div>

          {l.description && (
            <p className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-xs">
              {l.description}
            </p>
          )}

          {listingReports.length > 0 && (
            <ul className="space-y-1 rounded-md border border-destructive/40 p-2 text-xs">
              {listingReports.map((r) => (
                <li key={r.id}>• <strong>{r.reason}</strong>{r.details ? ` — ${r.details}` : ""}</li>
              ))}
            </ul>
          )}

          {mode === "pending" && (
            <Textarea rows={2} placeholder="Motivo (obrigatório para reprovar)"
              value={reasons[l.id] ?? ""}
              onChange={(e) => setReasons({ ...reasons, [l.id]: e.target.value })} />
          )}

          <div className="flex flex-wrap gap-2">
            {l.status === "active" && (
              <Button asChild size="sm" variant="outline">
                <a href={listingUrl(l.slug || l.id)} target="_blank" rel="noreferrer">
                  <Eye className="mr-1 h-3 w-3" /> Ver
                </a>
              </Button>
            )}
            {mode === "pending" && (
              <>
                <Button size="sm" onClick={() => moderate(l.id, "approve")} disabled={busy === l.id + "approve"}>
                  {busy === l.id + "approve" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <CheckCircle2 className="mr-1 h-3 w-3" />}
                  Aprovar
                </Button>
                <Button size="sm" variant="destructive"
                  onClick={() => moderate(l.id, "reject", { reason: reasons[l.id] ?? "" })}
                  disabled={busy === l.id + "reject" || !(reasons[l.id] ?? "").trim()}>
                  <XCircle className="mr-1 h-3 w-3" /> Reprovar
                </Button>
              </>
            )}
            {mode === "review" && (
              <>
                <Button size="sm" variant="outline" onClick={() => moderate(l.id, "mark_reviewed")}>
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Revisado
                </Button>
                <Button size="sm" variant="destructive"
                  onClick={() => moderate(l.id, "reject", { reason: reasons[l.id] || "Anúncio removido pela curadoria" })}>
                  <XCircle className="mr-1 h-3 w-3" /> Remover
                </Button>
              </>
            )}
            {l.status === "active" && (
              <Button size="sm" variant="secondary" onClick={() => dispatchWa(l.id)} disabled={busy === l.id + "wa"}>
                {busy === l.id + "wa" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Send className="mr-1 h-3 w-3" />}
                Disparar em grupos
              </Button>
            )}
            {l.contact_whatsapp && (
              <Button asChild size="sm" variant="ghost">
                <a href={`https://wa.me/55${l.contact_whatsapp.replace(/\D/g, "").replace(/^55/, "")}`} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-1 h-3 w-3" /> Anunciante
                </a>
              </Button>
            )}
            {listingReports.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => moderate(l.id, "resolve_reports")}>
                Resolver denúncias
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive"
              onClick={() => moderate(l.id, "revoke_auto_approval", { reason: reasons[l.id] || "Auto-aprovação revogada" })}>
              <ShieldOff className="mr-1 h-3 w-3" /> Revogar auto-aprovação
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const reportedIds = new Set(reports.map((r) => r.listing_id));
  const reported = active.filter((l) => reportedIds.has(l.id));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-lg">Canal de Equipamentos Usados</CardTitle>
            <p className="text-sm text-muted-foreground">
              Clientes publicam na hora (auditoria posterior). Não clientes entram na fila manual.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Na fila", value: pending.length },
            { label: "Auto-aprovados sem auditoria", value: autoReview.length },
            { label: "No ar", value: active.length },
            { label: "Denúncias abertas", value: reports.length },
          ].map((m) => (
            <div key={m.label} className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="pending">Fila ({pending.length})</TabsTrigger>
          <TabsTrigger value="review">Auditoria ({autoReview.length})</TabsTrigger>
          <TabsTrigger value="reported">Denunciados ({reported.length})</TabsTrigger>
          <TabsTrigger value="active">No ar ({active.length})</TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="mt-4 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32 w-full" />)}</div>
        ) : (
          <>
            <TabsContent value="pending" className="mt-4 space-y-3">
              {pending.length === 0
                ? <p className="py-8 text-center text-sm text-muted-foreground">Nada na fila.</p>
                : pending.map((l) => <ListingCard key={l.id} l={l} mode="pending" />)}
            </TabsContent>
            <TabsContent value="review" className="mt-4 space-y-3">
              {autoReview.length === 0
                ? <p className="py-8 text-center text-sm text-muted-foreground">Todos os auto-aprovados já foram auditados.</p>
                : autoReview.map((l) => <ListingCard key={l.id} l={l} mode="review" />)}
            </TabsContent>
            <TabsContent value="reported" className="mt-4 space-y-3">
              {reported.length === 0
                ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma denúncia aberta.</p>
                : reported.map((l) => <ListingCard key={l.id} l={l} mode="review" />)}
            </TabsContent>
            <TabsContent value="active" className="mt-4 space-y-3">
              {active.map((l) => <ListingCard key={l.id} l={l} mode="active" />)}
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}
