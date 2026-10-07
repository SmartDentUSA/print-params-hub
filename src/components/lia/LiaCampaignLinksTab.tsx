import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Copy, Loader2, Save, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { buildLiaUrl } from "@/lib/attendanceChannel";
import AttendanceChannelMetrics from "./AttendanceChannelMetrics";

type C = { id: string; nome: string; lia_slug: string | null; lia_opening_message: string | null; lia_product_name: string | null };
const PUBLIC_BASE = "https://admin.smartdent.com.br";
const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function Row({ c, products, onSaved }: { c: C; products: string[]; onSaved: () => void }) {
  const [slug, setSlug] = useState(c.lia_slug ?? "");
  const [opening, setOpening] = useState(c.lia_opening_message ?? "");
  const [product, setProduct] = useState(c.lia_product_name ?? "");
  const [saving, setSaving] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);

  const save = async () => {
    const s = slugify(slug || c.nome);
    setSaving(true);
    const { error } = await (supabase as any).from("campaigns").update({ lia_slug: s, lia_opening_message: opening.trim() || null, lia_product_name: product.trim() || null }).eq("id", c.id);
    setSaving(false);
    if (error) { toast.error(error.code === "23505" ? "Esse identificador já está em uso em outra campanha." : "Não foi possível salvar."); return; }
    setSlug(s);
    toast.success("Link da LIA salvo");
    onSaved();
  };
  const link = c.lia_slug ? buildLiaUrl({ campaign: c.lia_slug, base: PUBLIC_BASE }) + `&utm_source=campanha&utm_medium=whatsapp_lia&utm_campaign=${c.lia_slug}` : "";

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{c.nome}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div><Label>Identificador do link</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(c.nome)} /></div>
          <div>
            <Label>Produto de interesse</Label>
            <Input list={`prod-${c.id}`} value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ex.: Resina Vitality" />
            <datalist id={`prod-${c.id}`}>{products.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
        </div>
        <div><Label>Mensagem de abertura</Label><Textarea rows={2} value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="Olá! Vi que você se interessou pela Resina Vitality…" /></div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-4 w-4" />}Salvar</Button>
          <Button size="sm" variant="outline" disabled={!link} onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}>
            <MessageCircle className="mr-1 h-4 w-4" /> Gerar link da LIA
          </Button>
          {c.lia_slug && <Button size="sm" variant="ghost" onClick={() => setShowMetrics((v) => !v)}>{showMetrics ? "Ocultar métricas" : "Ver métricas"}</Button>}
        </div>
        {link && <p className="break-all rounded bg-muted p-2 text-xs"><Copy className="mr-1 inline h-3 w-3" />{link}</p>}
        {showMetrics && c.lia_slug && <AttendanceChannelMetrics campaignSlug={c.lia_slug} />}
      </CardContent>
    </Card>
  );
}

export default function LiaCampaignLinksTab() {
  const [rows, setRows] = useState<C[] | null>(null);
  const [products, setProducts] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const load = () => (supabase as any).from("campaigns").select("id,nome,lia_slug,lia_opening_message,lia_product_name").order("created_at", { ascending: false }).limit(200).then(({ data }: any) => setRows(data ?? []));
  useEffect(() => {
    load();
    (supabase as any).from("products_catalog").select("name").eq("active", true).limit(1000).then(({ data }: any) => setProducts(Array.from(new Set((data ?? []).map((p: any) => p.name).filter(Boolean))) as string[]));
  }, []);
  const list = (rows ?? []).filter((r) => !q || r.nome?.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <AttendanceChannelMetrics title="Todos os canais de atendimento — formulários x especialista x WhatsApp (90 dias)" />
      <Input placeholder="Buscar campanha…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      {!rows ? <Loader2 className="h-5 w-5 animate-spin" /> : list.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma campanha encontrada.</p> : list.map((c) => <Row key={c.id} c={c} products={products} onSaved={load} />)}
    </div>
  );
}
