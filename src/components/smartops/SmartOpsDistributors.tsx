import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Globe, Instagram, Facebook, Linkedin, Youtube, MapPin, Building2, Link2 } from "lucide-react";
import { AuthorizedScope } from "@/components/knowledge/kbCategoryTaxonomy";
import { DistributorForm, emptyDistributorForm, DistributorFormValue } from "./DistributorForm";

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
};
export function SmartOpsDistributors() {
  const [items, setItems] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [form, setForm] = useState<DistributorFormValue>(emptyDistributorForm());
  const [saving, setSaving] = useState(false);

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
                <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                    <Pencil className="w-3 h-3 mr-1" /> Editar
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
    </div>
  );
}