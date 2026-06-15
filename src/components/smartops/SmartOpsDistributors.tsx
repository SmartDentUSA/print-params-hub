import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Globe, Instagram, Facebook, Linkedin, Youtube, MapPin, Building2, Upload, X } from "lucide-react";

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
};

// Lightweight geo dataset. Adicione países conforme necessário.
const GEO: Record<string, { ddi: string; states: Record<string, string[]> }> = {
  Brasil: {
    ddi: "+55",
    states: {
      "AC": ["Rio Branco", "Cruzeiro do Sul"],
      "AL": ["Maceió", "Arapiraca"],
      "AM": ["Manaus", "Parintins"],
      "AP": ["Macapá", "Santana"],
      "BA": ["Salvador", "Feira de Santana", "Vitória da Conquista"],
      "CE": ["Fortaleza", "Caucaia", "Juazeiro do Norte"],
      "DF": ["Brasília"],
      "ES": ["Vitória", "Vila Velha", "Serra"],
      "GO": ["Goiânia", "Anápolis", "Aparecida de Goiânia"],
      "MA": ["São Luís", "Imperatriz"],
      "MG": ["Belo Horizonte", "Uberlândia", "Contagem", "Juiz de Fora"],
      "MS": ["Campo Grande", "Dourados"],
      "MT": ["Cuiabá", "Várzea Grande"],
      "PA": ["Belém", "Ananindeua", "Santarém"],
      "PB": ["João Pessoa", "Campina Grande"],
      "PE": ["Recife", "Jaboatão dos Guararapes", "Olinda"],
      "PI": ["Teresina", "Parnaíba"],
      "PR": ["Curitiba", "Londrina", "Maringá"],
      "RJ": ["Rio de Janeiro", "Niterói", "Nova Iguaçu", "Duque de Caxias"],
      "RN": ["Natal", "Mossoró"],
      "RO": ["Porto Velho", "Ji-Paraná"],
      "RR": ["Boa Vista"],
      "RS": ["Porto Alegre", "Caxias do Sul", "Pelotas"],
      "SC": ["Florianópolis", "Joinville", "Blumenau"],
      "SE": ["Aracaju"],
      "SP": ["São Paulo", "Campinas", "Santos", "Ribeirão Preto", "Sorocaba", "São José dos Campos"],
      "TO": ["Palmas", "Araguaína"],
    },
  },
  Portugal: {
    ddi: "+351",
    states: {
      "Lisboa": ["Lisboa", "Sintra", "Cascais"],
      "Porto": ["Porto", "Vila Nova de Gaia", "Matosinhos"],
      "Coimbra": ["Coimbra"],
      "Braga": ["Braga", "Guimarães"],
      "Faro": ["Faro", "Albufeira"],
    },
  },
  "Estados Unidos": {
    ddi: "+1",
    states: {
      "FL": ["Miami", "Orlando", "Tampa"],
      "CA": ["Los Angeles", "San Francisco", "San Diego"],
      "NY": ["New York", "Buffalo"],
      "TX": ["Houston", "Dallas", "Austin"],
    },
  },
  Argentina: {
    ddi: "+54",
    states: {
      "Buenos Aires": ["Buenos Aires", "La Plata", "Mar del Plata"],
      "Córdoba": ["Córdoba"],
      "Mendoza": ["Mendoza"],
    },
  },
  Chile: {
    ddi: "+56",
    states: { "RM": ["Santiago"], "V": ["Valparaíso", "Viña del Mar"] },
  },
  Paraguai: { ddi: "+595", states: { "Central": ["Asunción"] } },
  Uruguai: { ddi: "+598", states: { "Montevideo": ["Montevideo"] } },
  Colombia: { ddi: "+57", states: { "Cundinamarca": ["Bogotá"], "Antioquia": ["Medellín"] } },
  México: { ddi: "+52", states: { "CDMX": ["Ciudad de México"], "Jalisco": ["Guadalajara"] } },
};

const DDI_OPTIONS = [
  { code: "+55", label: "🇧🇷 +55" },
  { code: "+1", label: "🇺🇸 +1" },
  { code: "+351", label: "🇵🇹 +351" },
  { code: "+54", label: "🇦🇷 +54" },
  { code: "+56", label: "🇨🇱 +56" },
  { code: "+57", label: "🇨🇴 +57" },
  { code: "+52", label: "🇲🇽 +52" },
  { code: "+595", label: "🇵🇾 +595" },
  { code: "+598", label: "🇺🇾 +598" },
  { code: "+34", label: "🇪🇸 +34" },
  { code: "+44", label: "🇬🇧 +44" },
];

const emptyForm = (): Partial<Distributor> => ({
  razao_social: "",
  nome_fantasia: "",
  logo_url: "",
  pais: "Brasil",
  estado: "",
  cidade: "",
  endereco: "",
  cep: "",
  numero_unidades: 1,
  site_url: "",
  instagram: "",
  facebook: "",
  linkedin: "",
  youtube: "",
  owner_name: "",
  owner_email: "",
  owner_whatsapp_ddi: "+55",
  owner_whatsapp: "",
  buyer_name: "",
  buyer_email: "",
  buyer_whatsapp_ddi: "+55",
  buyer_whatsapp: "",
  active: true,
  notes: "",
});

export function SmartOpsDistributors() {
  const [items, setItems] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [form, setForm] = useState<Partial<Distributor>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (d: Distributor) => {
    setEditing(d);
    setForm({ ...d });
    setOpen(true);
  };

  const handleCountryChange = (pais: string) => {
    const ddi = GEO[pais]?.ddi || "+55";
    setForm((f) => ({
      ...f,
      pais,
      estado: "",
      cidade: "",
      owner_whatsapp_ddi: f.owner_whatsapp_ddi || ddi,
      buyer_whatsapp_ddi: f.buyer_whatsapp_ddi || ddi,
    }));
  };

  const handleLogoUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo deve ter no máximo 5MB");
      return;
    }
    setUploadingLogo(true);
    const ext = file.name.split(".").pop() || "png";
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("distributor-logos")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (upErr) {
      setUploadingLogo(false);
      toast.error("Erro no upload: " + upErr.message);
      return;
    }
    const { data } = supabase.storage.from("distributor-logos").getPublicUrl(path);
    setForm((f) => ({ ...f, logo_url: data.publicUrl }));
    setUploadingLogo(false);
    toast.success("Logo enviado");
  };

  const statesList = useMemo(() => Object.keys(GEO[form.pais || ""]?.states || {}), [form.pais]);
  const citiesList = useMemo(
    () => GEO[form.pais || ""]?.states[form.estado || ""] || [],
    [form.pais, form.estado]
  );

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Distribuição</h3>
          <p className="text-sm text-muted-foreground">Cadastro de distribuidores credenciados</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" /> Novo Distribuidor</Button>
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
                  <Select value={form.pais || ""} onValueChange={handleCountryChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(GEO).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Estado / Província</Label>
                  <Select value={form.estado || ""} onValueChange={(v) => setForm({ ...form, estado: v, cidade: "" })} disabled={!statesList.length}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {statesList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cidade</Label>
                  {citiesList.length ? (
                    <Select value={form.cidade || ""} onValueChange={(v) => setForm({ ...form, cidade: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {citiesList.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
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