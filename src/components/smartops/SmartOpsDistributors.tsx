import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Globe, Instagram, Facebook, Linkedin, Youtube, MapPin, Building2, Link2, Share2 } from "lucide-react";
import { AuthorizedScope } from "@/components/knowledge/kbCategoryTaxonomy";
import { DistributorForm, emptyDistributorForm, DistributorFormValue } from "./DistributorForm";
import { DistributorKitDialog, KitDistributor } from "./DistributorKitDialog";

type Distributor = {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  logo_url: string | null;
  pais: string | null;
  estado: string | null;
  cidade: string | null;
  endereco: string | null;
  cep: string | null;
  numero_unidades: number | null;
  site_url: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  youtube: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_whatsapp_ddi: string | null;
  owner_whatsapp: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_whatsapp_ddi: string | null;
  buyer_whatsapp: string | null;
  active: boolean;
  notes: string | null;
  authorized_scope: AuthorizedScope | null;
  backlink_status?: string | null;
  backlink_url?: string | null;
  backlink_verified_at?: string | null;
  preferred_currency?: string | null;
  language_preference?: string | null;
};
export function SmartOpsDistributors() {
  const [items, setItems] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [form, setForm] = useState<DistributorFormValue>(emptyDistributorForm());
  const [saving, setSaving] = useState(false);
  const [kitOpen, setKitOpen] = useState(false);
  const [kitTarget, setKitTarget] = useState<KitDistributor | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyingAll, setVerifyingAll] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("distributors" as any)
      .select("*")
      .order("razao_social", { ascending: true });
    if (error) toast.error("Erro ao carregar: " + error.message);
    setItems((data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm(emptyDistributorForm());
    setOpen(true);
  };

  const openEdit = (d: Distributor) => {
    setEditing(d);
    setForm({ ...d } as DistributorFormValue);
    setOpen(true);
  };

  const save = async () => {
    if (!form.razao_social?.trim()) {
      toast.error("Razão Social é obrigatória");
      return;
    }
    setSaving(true);
    const payload = { ...form, active: form.active ?? true };
    delete (payload as any).id;
    delete (payload as any).created_at;
    delete (payload as any).updated_at;

    const q = editing
      ? supabase.from("distributors" as any).update(payload).eq("id", editing.id)
      : supabase.from("distributors" as any).insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error("Erro ao salvar: " + error.message); return; }
    toast.success(editing ? "Distribuidor atualizado" : "Distribuidor cadastrado");
    setOpen(false);
    load();
  };

  const remove = async (d: Distributor) => {
    if (!confirm(`Excluir distribuidor "${d.razao_social}"?`)) return;
    const { error } = await supabase.from("distributors" as any).delete().eq("id", d.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Excluído");
    load();
  };

  const verifyBacklink = async (d?: Distributor) => {
    try {
      if (d) setVerifyingId(d.id);
      else setVerifyingAll(true);
      const { data, error } = await supabase.functions.invoke("verify-distributor-backlink", {
        body: d ? { distributor_id: d.id } : {},
        method: "POST" as any,
      });
      if (error) throw error;
      const checked = (data as any)?.checked ?? 0;
      toast.success(`Verificação concluída (${checked} distribuidor${checked === 1 ? "" : "es"})`);
      load();
    } catch (e: any) {
      toast.error("Erro: " + (e?.message || "tente novamente"));
    } finally {
      setVerifyingId(null);
      setVerifyingAll(false);
    }
  };

  const backlinkBadge = (d: Distributor) => {
    if (!d.site_url) return null;
    const s = d.backlink_status;
    const map: Record<string, { label: string; cls: string }> = {
      found:       { label: "🔗 backlink ok",  cls: "bg-green-100 text-green-800 border-green-300" },
      mention:     { label: "≈ cita s/ link",  cls: "bg-amber-100 text-amber-800 border-amber-300" },
      missing:     { label: "✗ sem backlink",  cls: "bg-red-100 text-red-800 border-red-300" },
      unreachable: { label: "? site offline",  cls: "bg-slate-100 text-slate-700 border-slate-300" },
    };
    const cfg = s ? map[s] : { label: "— não verificado", cls: "bg-slate-50 text-slate-500 border-slate-200" };
    if (!cfg) return null;
    const tip = d.backlink_verified_at
      ? `Verificado em ${new Date(d.backlink_verified_at).toLocaleString("pt-BR")}${d.backlink_url ? ` — encontrado: ${d.backlink_url}` : ""}`
      : "Nunca verificado";
    return (
      <span title={tip} className={`text-[10px] px-1.5 py-0.5 rounded border ${cfg.cls}`}>
        {cfg.label}
      </span>
    );
  };

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/cadastro-distribuidor`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link público copiado", { description: url });
    } catch {
      toast.info(url, { description: "Copie manualmente" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Distribuição</h3>
          <p className="text-sm text-muted-foreground">Cadastro de distribuidores credenciados</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyPublicLink}>
            <Link2 className="w-4 h-4 mr-2" /> Copiar link público
          </Button>
          <Button variant="outline" onClick={() => verifyBacklink()} disabled={verifyingAll}>
            <Globe className="w-4 h-4 mr-2" /> {verifyingAll ? "Verificando…" : "Verificar backlinks"}
          </Button>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo Distribuidor</Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Nenhum distribuidor cadastrado ainda.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((d) => (
            <Card key={d.id} className="cursor-pointer hover:shadow-md transition" onClick={() => openEdit(d)}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="text-base flex items-center gap-2">
                      {d.logo_url ? (
                        <img src={d.logo_url} alt={d.razao_social} className="w-8 h-8 rounded object-contain bg-muted shrink-0" />
                      ) : (
                        <Building2 className="w-4 h-4 shrink-0" />
                      )}
                      <span className="truncate">{d.nome_fantasia || d.razao_social}</span>
                    </CardTitle>
                    {d.nome_fantasia && (
                      <p className="text-xs text-muted-foreground truncate mt-1">{d.razao_social}</p>
                    )}
                  </div>
                  <Badge variant={d.active ? "default" : "secondary"}>
                    {d.active ? "Ativo" : "Inativo"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(d.cidade || d.estado || d.pais) && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">
                      {[d.cidade, d.estado, d.pais].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                )}
                {d.numero_unidades && d.numero_unidades > 1 && (
                  <p className="text-xs text-muted-foreground">{d.numero_unidades} unidades</p>
                )}
                <div className="flex gap-2 pt-1 text-muted-foreground">
                  {d.site_url && <Globe className="w-4 h-4" />}
                  {d.instagram && <Instagram className="w-4 h-4" />}
                  {d.facebook && <Facebook className="w-4 h-4" />}
                  {d.linkedin && <Linkedin className="w-4 h-4" />}
                  {d.youtube && <Youtube className="w-4 h-4" />}
                </div>
                {d.site_url && (
                  <div className="flex items-center gap-2 pt-1">
                    {backlinkBadge(d)}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); verifyBacklink(d); }}
                      disabled={verifyingId === d.id}
                      className="text-[10px] text-primary hover:underline"
                    >
                      {verifyingId === d.id ? "verificando…" : "re-verificar"}
                    </button>
                  </div>
                )}
                <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setKitTarget({
                        razao_social: d.razao_social,
                        nome_fantasia: d.nome_fantasia,
                        pais: d.pais,
                        slug: (d as any).slug ?? null,
                      });
                      setKitOpen(true);
                    }}
                  >
                    <Share2 className="w-3 h-3 mr-1" /> Kit
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(d)}>
                    <Trash2 className="w-3 h-3 mr-1" /> Excluir
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Distribuidor" : "Novo Distribuidor"}</DialogTitle>
          </DialogHeader>

          <DistributorForm value={form} onChange={setForm} />

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DistributorKitDialog open={kitOpen} onOpenChange={setKitOpen} distributor={kitTarget} />
    </div>
  );
}