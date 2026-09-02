import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ImagePlus, Loader2, PlayCircle, PlusCircle, Trash2, X } from "lucide-react";
import {
  CLASSIFIED_CATEGORIES, CLASSIFIED_CONDITIONS, CLASSIFIEDS_BUCKET, CLASSIFIED_STATUS_LABEL,
  CLASSIFIED_MEDIA_ACCEPT, MAX_CLASSIFIED_IMAGES, UFS, formatPrice, imageList, isVideoUrl, listingUrl,
} from "@/lib/classifieds";

interface MyListing {
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
  moderation_reason: string | null;
  view_count: number | null;
  wa_click_count: number | null;
  expires_at: string | null;
  contact_whatsapp: string | null;
}

const emptyForm = {
  id: "" as string,
  title: "",
  description: "",
  price: "",
  condition: "good",
  category: "scanner",
  location_city: "",
  location_state: "SP",
  contact_whatsapp: "",
  images: [] as string[],
};

export default function UsadosMeusAnuncios() {
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [listings, setListings] = useState<MyListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const autoEdited = useRef(false);

  const load = useCallback(async (_uid: string) => {
    setLoading(true);
    // RPC segura: devolve somente os anúncios do usuário autenticado (com telefone).
    const { data } = await (supabase as any).rpc("fn_my_classifieds");
    setListings((data ?? []) as MyListing[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      setChecking(false);
      if (uid) load(uid);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id ?? null;
      setUserId(uid);
      if (uid) load(uid);
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  async function uploadImages(files: FileList) {
    if (!userId) return;
    const remaining = MAX_CLASSIFIED_IMAGES - form.images.length;
    if (remaining <= 0) {
      toast({ title: `Máximo de ${MAX_CLASSIFIED_IMAGES} arquivos`, variant: "destructive" });
      return;
    }
    setUploading(true);
    const urls: string[] = [];
    for (const file of Array.from(files).slice(0, remaining)) {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `classifieds/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from(CLASSIFIEDS_BUCKET).upload(path, file, { upsert: false });
      if (error) {
        toast({ title: "Falha no upload", description: error.message, variant: "destructive" });
        continue;
      }
      urls.push(supabase.storage.from(CLASSIFIEDS_BUCKET).getPublicUrl(path).data.publicUrl);
    }
    setForm((f) => ({ ...f, images: [...f.images, ...urls] }));
    setUploading(false);
  }

  async function save() {
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("classifieds-submit", {
      body: {
        id: form.id || undefined,
        title: form.title,
        description: form.description,
        price: form.price ? Number(form.price.replace(/\D/g, "")) : null,
        condition: form.condition,
        category: form.category,
        location_city: form.location_city,
        location_state: form.location_state,
        contact_whatsapp: form.contact_whatsapp,
        images: form.images,
      },
    });
    setSaving(false);
    const payload = data as { error?: string; message?: string } | null;
    if (error || payload?.error) {
      toast({ title: "Não foi possível salvar", description: payload?.error ?? error?.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pronto!", description: payload?.message ?? "Anúncio atualizado." });
    setShowForm(false);
    setForm(emptyForm);
    if (userId) load(userId);
  }

  function editListing(l: MyListing) {
    setForm({
      id: l.id,
      title: l.title,
      description: l.description ?? "",
      price: l.price != null ? String(l.price) : "",
      condition: l.condition ?? "good",
      category: l.category ?? "scanner",
      location_city: l.location_city ?? "",
      location_state: l.location_state ?? "SP",
      contact_whatsapp: l.contact_whatsapp ?? "",
      images: imageList(l.images),
    });
    setShowForm(true);
  }

  // Abre direto o formulário quando vem de /usados/:slug com ?edit=<id>.
  useEffect(() => {
    const editId = params.get("edit");
    if (!editId || autoEdited.current || listings.length === 0) return;
    const target = listings.find((l) => l.id === editId);
    if (!target) return;
    autoEdited.current = true;
    editListing(target);
    params.delete("edit");
    setParams(params, { replace: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [listings, params, setParams]);



  async function markSold(l: MyListing) {
    const { error } = await (supabase as any)
      .from("classified_listings")
      .update({ status: "sold", sold_at: new Date().toISOString() })
      .eq("id", l.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Marcado como vendido" });
    if (userId) load(userId);
  }

  async function removeListing(l: MyListing) {
    const { error } = await (supabase as any)
      .from("classified_listings").update({ status: "removed" }).eq("id", l.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    if (userId) load(userId);
  }

  if (checking) return <div className="p-8"><Skeleton className="h-40 w-full" /></div>;

  if (!userId) {
    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold">Entre para anunciar</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Use seu WhatsApp para receber um link de acesso. Clientes Smart Dent têm publicação imediata.
        </p>
        <Button asChild className="mt-4 w-full"><Link to="/entrar?redirect=/usados/meus-anuncios">Entrar</Link></Button>
        <Button asChild variant="ghost" className="mt-2 w-full"><Link to="/usados">Ver equipamentos</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-5">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link to="/usados"><ArrowLeft className="mr-1 h-4 w-4" /> Equipamentos usados</Link>
        </Button>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">Meus anúncios</h1>
          {!showForm && (
            <Button onClick={() => { setForm(emptyForm); setShowForm(true); }}>
              <PlusCircle className="mr-2 h-4 w-4" /> Novo
            </Button>
          )}
        </div>

        {showForm && (
          <Card className="mt-4">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{form.id ? "Editar anúncio" : "Novo anúncio"}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => { setShowForm(false); setForm(emptyForm); }}>
                <X className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Título *</Label>
                <Input value={form.title} maxLength={120}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ex.: Scanner intraoral Aoralscan 3 — 2023" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Categoria *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLASSIFIED_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Estado de conservação *</Label>
                  <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLASSIFIED_CONDITIONS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <Label>Preço (R$)</Label>
                  <Input value={form.price} inputMode="numeric"
                    onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="A combinar" />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label>Cidade</Label>
                  <Input value={form.location_city} onChange={(e) => setForm({ ...form, location_city: e.target.value })} />
                </div>
                <div className="space-y-1 col-span-1">
                  <Label>UF</Label>
                  <Select value={form.location_state} onValueChange={(v) => setForm({ ...form, location_state: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UFS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>WhatsApp de contato</Label>
                <Input value={form.contact_whatsapp} inputMode="tel"
                  onChange={(e) => setForm({ ...form, contact_whatsapp: e.target.value })}
                  placeholder="(16) 99999-9999" />
              </div>
              <div className="space-y-1">
                <Label>Descrição</Label>
                <Textarea rows={5} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Tempo de uso, acessórios inclusos, motivo da venda, nota fiscal..." />
              </div>
              <div className="space-y-2">
                <Label>Fotos (até {MAX_CLASSIFIED_IMAGES})</Label>
                <div className="flex flex-wrap gap-2">
                  {form.images.map((img) => (
                    <div key={img} className="relative h-20 w-20 overflow-hidden rounded-lg border">
                      <img src={img} alt="Foto do equipamento" className="h-full w-full object-cover" />
                      <button type="button"
                        onClick={() => setForm({ ...form, images: form.images.filter((i) => i !== img) })}
                        className="absolute right-0 top-0 bg-background/80 p-1">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs text-muted-foreground">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    Adicionar
                    <input type="file" accept="image/*" multiple className="hidden"
                      onChange={(e) => e.target.files && uploadImages(e.target.files)} />
                  </label>
                </div>
              </div>
              <Button className="w-full" onClick={save} disabled={saving || uploading}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {form.id ? "Salvar alterações" : "Publicar anúncio"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Clientes Smart Dent publicam na hora. Novos anunciantes passam por uma revisão rápida
                (até 1 dia útil) e recebem aviso no WhatsApp.
              </p>
            </CardContent>
          </Card>
        )}

        <div className="mt-5 space-y-3">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : listings.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Você ainda não tem anúncios.</p>
          ) : listings.map((l) => (
            <Card key={l.id}>
              <CardContent className="flex gap-3 p-3">
                <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                  {imageList(l.images)[0] && (
                    <img src={imageList(l.images)[0]} alt={l.title} className="h-full w-full object-cover" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-semibold">{l.title}</p>
                    <Badge variant={l.status === "active" ? "default" : "secondary"}>
                      {CLASSIFIED_STATUS_LABEL[l.status] ?? l.status}
                    </Badge>
                  </div>
                  <p className="text-sm font-bold text-primary">{formatPrice(l.price)}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.view_count ?? 0} visualizações · {l.wa_click_count ?? 0} contatos
                  </p>
                  {l.moderation_reason && l.status === "removed" && (
                    <p className="mt-1 text-xs text-destructive">Motivo: {l.moderation_reason}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {l.status === "active" && (
                      <Button asChild size="sm" variant="outline">
                        <Link to={listingUrl(l.slug || l.id)}>Ver</Link>
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => editListing(l)}>Editar</Button>
                    {l.status === "active" && (
                      <Button size="sm" variant="secondary" onClick={() => markSold(l)}>Marcar vendido</Button>
                    )}
                    {l.status !== "removed" && (
                      <Button size="sm" variant="ghost" className="text-destructive"
                        onClick={() => removeListing(l)}>
                        <Trash2 className="mr-1 h-3 w-3" /> Remover
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
