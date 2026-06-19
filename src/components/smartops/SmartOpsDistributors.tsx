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

          <div className="space-y-6 py-2">
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Identificação</h4>
              <div>
                <Label>Logo da empresa</Label>
                <div className="flex items-center gap-3 mt-2">
                  {form.logo_url ? (
                    <div className="relative">
                      <img src={form.logo_url} alt="Logo" className="w-20 h-20 rounded border object-contain bg-muted" />
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, logo_url: "" })}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5"
                        aria-label="Remover logo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded border border-dashed flex items-center justify-center text-muted-foreground">
                      <Building2 className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <input
                      id="logo-upload-input"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ""; }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingLogo}
                      onClick={() => document.getElementById("logo-upload-input")?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploadingLogo ? "Enviando…" : "Enviar logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, WebP ou SVG — máx 5MB</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Razão Social *</Label>
                  <Input value={form.razao_social || ""} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} />
                </div>
                <div>
                  <Label>Nome Fantasia</Label>
                  <Input value={form.nome_fantasia || ""} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.active ?? true} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label>Ativo</Label>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Localização</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label>País</Label>
                  <Combobox
                    value={selectedCountry?.name || ""}
                    placeholder="Selecione o país"
                    emptyText="Nenhum país encontrado"
                    options={ALL_COUNTRIES.map((c) => ({
                      value: c.name,
                      label: `${c.flag || ""} ${c.name}`.trim(),
                    }))}
                    onChange={(v) => handleCountryChange(v)}
                  />
                </div>
                <div>
                  <Label>Estado / Província</Label>
                  <Combobox
                    value={selectedState?.name || form.estado || ""}
                    placeholder={statesList.length ? "Selecione" : "—"}
                    emptyText="Nenhum estado encontrado"
                    disabled={!statesList.length}
                    options={statesList.map((s) => ({ value: s.name, label: s.name }))}
                    onChange={(v) => setForm({ ...form, estado: v, cidade: "" })}
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  {citiesList.length ? (
                    <Combobox
                      value={form.cidade || ""}
                      placeholder="Selecione"
                      emptyText="Nenhuma cidade encontrada"
                      options={citiesList.map((c) => ({ value: c.name, label: c.name }))}
                      onChange={(v) => setForm({ ...form, cidade: v })}
                    />
                  ) : (
                    <Input value={form.cidade || ""} onChange={(e) => setForm({ ...form, cidade: e.target.value })} placeholder="Digite a cidade" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <Label>Endereço Completo</Label>
                  <Input value={form.endereco || ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
                </div>
                <div>
                  <Label>CEP / Código Postal</Label>
                  <Input value={form.cep || ""} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Número de Unidades / Filiais</Label>
                <Input type="number" min={1} value={form.numero_unidades ?? 1} onChange={(e) => setForm({ ...form, numero_unidades: Number(e.target.value) || 1 })} />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Presença Digital</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Site Oficial (URL)</Label>
                  <Input value={form.site_url || ""} onChange={(e) => setForm({ ...form, site_url: e.target.value })} placeholder="https://…" />
                </div>
                <div>
                  <Label>Instagram</Label>
                  <Input value={form.instagram || ""} onChange={(e) => setForm({ ...form, instagram: e.target.value })} placeholder="@ ou URL" />
                </div>
                <div>
                  <Label>Facebook</Label>
                  <Input value={form.facebook || ""} onChange={(e) => setForm({ ...form, facebook: e.target.value })} />
                </div>
                <div>
                  <Label>LinkedIn da empresa</Label>
                  <Input value={form.linkedin || ""} onChange={(e) => setForm({ ...form, linkedin: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Canal YouTube</Label>
                  <Input value={form.youtube || ""} onChange={(e) => setForm({ ...form, youtube: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Contato — Proprietário / Diretor</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.owner_name || ""} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.owner_email || ""} onChange={(e) => setForm({ ...form, owner_email: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>WhatsApp</Label>
                  <div className="flex gap-2">
                    <Select value={form.owner_whatsapp_ddi || "+55"} onValueChange={(v) => setForm({ ...form, owner_whatsapp_ddi: v })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DDI_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="flex-1" value={form.owner_whatsapp || ""} onChange={(e) => setForm({ ...form, owner_whatsapp: e.target.value })} placeholder="Número" />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Contato — Responsável de Compras</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={form.buyer_name || ""} onChange={(e) => setForm({ ...form, buyer_name: e.target.value })} />
                </div>
                <div>
                  <Label>E-mail</Label>
                  <Input type="email" value={form.buyer_email || ""} onChange={(e) => setForm({ ...form, buyer_email: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>WhatsApp</Label>
                  <div className="flex gap-2">
                    <Select value={form.buyer_whatsapp_ddi || "+55"} onValueChange={(v) => setForm({ ...form, buyer_whatsapp_ddi: v })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DDI_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input className="flex-1" value={form.buyer_whatsapp || ""} onChange={(e) => setForm({ ...form, buyer_whatsapp: e.target.value })} placeholder="Número" />
                  </div>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <Label>Observações</Label>
              <Textarea rows={3} value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </section>

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Autorização Comercial</h4>
                  <p className="text-xs text-muted-foreground">Categorias e subcategorias que esta revenda está autorizada a comercializar.</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const all: AuthorizedScope = {};
                      CANONICAL_CATS.forEach((c) => { all[c] = [...(catalogTaxonomy[c] || [])]; });
                      setForm((f) => ({ ...f, authorized_scope: all }));
                    }}
                  >Selecionar tudo</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm((f) => ({ ...f, authorized_scope: {} }))}
                  >Limpar</Button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {CHIP_KEYS.filter((c) => c.key !== "all").map((c) => {
                  const cat = c.key;
                  const subs = catalogTaxonomy[cat] || [];
                  const scope = (form.authorized_scope || {}) as AuthorizedScope;
                  const enabled = Object.prototype.hasOwnProperty.call(scope, cat);
                  const selectedSubs = enabled ? (scope[cat] || []) : [];
                  const toggleCat = (on: boolean) => {
                    const next: AuthorizedScope = { ...(scope || {}) };
                    if (on) next[cat] = [];
                    else delete next[cat];
                    setForm((f) => ({ ...f, authorized_scope: next }));
                  };
                  const toggleSub = (sub: string) => {
                    const next: AuthorizedScope = { ...(scope || {}) };
                    const cur = new Set(next[cat] || []);
                    if (cur.has(sub)) cur.delete(sub); else cur.add(sub);
                    next[cat] = Array.from(cur);
                    setForm((f) => ({ ...f, authorized_scope: next }));
                  };
                  return (
                    <div key={cat} className="rounded-md border p-3 space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Checkbox checked={enabled} onCheckedChange={(v) => toggleCat(!!v)} />
                        <span className="text-sm font-medium">{cat}</span>
                      </label>
                      {enabled && subs.length > 0 && (
                        <div className="pl-6 space-y-1">
                          {subs.map((sub) => (
                            <label key={sub} className="flex items-center gap-2 text-xs cursor-pointer">
                              <Checkbox
                                checked={selectedSubs.includes(sub)}
                                onCheckedChange={() => toggleSub(sub)}
                              />
                              <span>{sub}</span>
                            </label>
                          ))}
                          <p className="text-[10px] text-muted-foreground pt-1">
                            Nenhuma subcategoria marcada = autoriza todas as subcategorias desta categoria.
                          </p>
                        </div>
                      )}
                      {enabled && subs.length === 0 && (
                        <p className="pl-6 text-[10px] text-muted-foreground">Sem subcategorias cadastradas.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}