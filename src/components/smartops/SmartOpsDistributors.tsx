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
import { Plus, Pencil, Trash2, Globe, Instagram, Facebook, Linkedin, Youtube, MapPin, Building2, Upload, X, Check, ChevronsUpDown } from "lucide-react";
import { Country, State, City } from "country-state-city";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { CANONICAL_CATS, CHIP_KEYS, normCat, AuthorizedScope } from "@/components/knowledge/kbCategoryTaxonomy";

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

// Aliases para nomes de país em PT-BR usados em registros legados.
const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "Brasil": "Brazil",
  "Estados Unidos": "United States",
  "México": "Mexico",
  "Paraguai": "Paraguay",
  "Uruguai": "Uruguay",
  "Colombia": "Colombia",
  "Alemanha": "Germany",
  "Espanha": "Spain",
  "França": "France",
  "Inglaterra": "United Kingdom",
  "Reino Unido": "United Kingdom",
  "Itália": "Italy",
  "Japão": "Japan",
  "China": "China",
  "Canadá": "Canada",
  "Suíça": "Switzerland",
  "Países Baixos": "Netherlands",
  "Holanda": "Netherlands",
};

const ALL_COUNTRIES = Country.getAllCountries();

function resolveCountry(name?: string | null) {
  if (!name) return undefined;
  const target = COUNTRY_NAME_ALIASES[name] || name;
  return ALL_COUNTRIES.find(
    (c) => c.name.toLowerCase() === target.toLowerCase()
  );
}

function formatDdi(phonecode?: string) {
  if (!phonecode) return "+55";
  const trimmed = phonecode.trim();
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

const DDI_OPTIONS = Array.from(
  new Map(
    ALL_COUNTRIES
      .filter((c) => c.phonecode)
      .map((c) => {
        const code = formatDdi(c.phonecode);
        return [code, { code, label: `${c.flag || ""} ${code} ${c.name}`.trim() }];
      })
  ).values()
).sort((a, b) => a.label.localeCompare(b.label));

function Combobox({
  value,
  options,
  placeholder,
  emptyText,
  disabled,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  emptyText: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar…" />
          <CommandList className="max-h-64">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === o.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

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
  authorized_scope: {},
});

export function SmartOpsDistributors() {
  const [items, setItems] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Distributor | null>(null);
  const [form, setForm] = useState<Partial<Distributor>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [catalogTaxonomy, setCatalogTaxonomy] = useState<Record<string, string[]>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("system_a_catalog")
        .select("product_category, product_subcategory")
        .eq("active", true)
        .eq("approved", true)
        .eq("visible_in_ui", true)
        .not("product_category", "is", null);
      const map: Record<string, Set<string>> = {};
      (data || []).forEach((r: any) => {
        const canon = normCat(r.product_category);
        if (!canon) return;
        if (!map[canon]) map[canon] = new Set<string>();
        const sub = (r.product_subcategory || "").trim();
        if (sub) map[canon].add(sub);
      });
      const out: Record<string, string[]> = {};
      CANONICAL_CATS.forEach((c) => {
        out[c] = Array.from(map[c] || []).sort((a, b) => a.localeCompare(b, "pt-BR"));
      });
      setCatalogTaxonomy(out);
    })();
  }, []);

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
    const country = resolveCountry(pais);
    const ddi = formatDdi(country?.phonecode);
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

  const selectedCountry = useMemo(() => resolveCountry(form.pais), [form.pais]);
  const statesList = useMemo(
    () => (selectedCountry ? State.getStatesOfCountry(selectedCountry.isoCode) : []),
    [selectedCountry]
  );
  const selectedState = useMemo(
    () =>
      selectedCountry && form.estado
        ? statesList.find(
            (s) =>
              s.name.toLowerCase() === (form.estado || "").toLowerCase() ||
              s.isoCode.toLowerCase() === (form.estado || "").toLowerCase()
          )
        : undefined,
    [selectedCountry, form.estado, statesList]
  );
  const citiesList = useMemo(
    () =>
      selectedCountry && selectedState
        ? City.getCitiesOfState(selectedCountry.isoCode, selectedState.isoCode)
        : [],
    [selectedCountry, selectedState]
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