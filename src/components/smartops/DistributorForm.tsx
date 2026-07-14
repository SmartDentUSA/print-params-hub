import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, ChevronsUpDown, Check, Upload, X } from "lucide-react";
import { Country, State, City } from "country-state-city";
import { cn } from "@/lib/utils";
import { CANONICAL_CATS, CHIP_KEYS, normCat, AuthorizedScope } from "@/components/knowledge/kbCategoryTaxonomy";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

// País (ISO-2) → idioma preferencial da página pública.
const COUNTRY_LANG: Record<string, "pt" | "es" | "en"> = {
  BR: "pt", PT: "pt",
  US: "en", CA: "en", GB: "en", AU: "en", IE: "en", NZ: "en",
  // LatAm + Espanha → es
  AR: "es", BO: "es", CL: "es", CO: "es", CR: "es", CU: "es", DO: "es",
  EC: "es", SV: "es", GT: "es", HN: "es", MX: "es", NI: "es", PA: "es",
  PY: "es", PE: "es", PR: "es", UY: "es", VE: "es", ES: "es",
};
const LANG_LABEL: Record<string, string> = { pt: "Português", es: "Español", en: "English" };
function languageForCountry(isoCode?: string): "pt" | "es" | "en" {
  if (!isoCode) return "pt";
  return COUNTRY_LANG[isoCode.toUpperCase()] || "pt";
}

// Heurística: extrai a "linha" comercial a partir do nome do produto.
// Ex.: "Smart Print Atos Try-In A2" → "Smart Print Atos"
//      "SmartMake Kit Inicial"     → "SmartMake"
//      "Vitality Resin 1kg"        → "Vitality"
function extractLine(name: string): string | null {
  if (!name) return null;
  const clean = name.replace(/\s+/g, " ").trim();
  // Remove sufixos comuns (cores, tamanhos, kits)
  const tokens = clean.split(" ");
  // Pega até 3 primeiros tokens que comecem com letra (não números/cores)
  const out: string[] = [];
  for (const t of tokens) {
    if (out.length >= 3) break;
    if (/^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.-]*$/.test(t)) out.push(t);
    else break;
  }
  const line = out.join(" ").trim();
  return line.length >= 2 ? line : null;
}

export type DistributorFormValue = {
  id?: string;
  razao_social?: string;
  nome_fantasia?: string | null;
  logo_url?: string | null;
  pais?: string | null;
  estado?: string | null;
  cidade?: string | null;
  endereco?: string | null;
  cep?: string | null;
  numero_unidades?: number | null;
  site_url?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  youtube?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
  owner_whatsapp_ddi?: string | null;
  owner_whatsapp?: string | null;
  buyer_name?: string | null;
  buyer_email?: string | null;
  buyer_whatsapp_ddi?: string | null;
  buyer_whatsapp?: string | null;
  active?: boolean;
  notes?: string | null;
  authorized_scope?: AuthorizedScope | null;
  service_areas?: string[] | null;
  linhas_representadas?: string[] | null;
  wikidata_id?: string | null;
  language_preference?: string | null;
};

const COUNTRY_NAME_ALIASES: Record<string, string> = {
  "Brasil": "Brazil", "Estados Unidos": "United States", "México": "Mexico",
  "Paraguai": "Paraguay", "Uruguai": "Uruguay", "Colombia": "Colombia",
  "Alemanha": "Germany", "Espanha": "Spain", "França": "France",
  "Inglaterra": "United Kingdom", "Reino Unido": "United Kingdom", "Itália": "Italy",
  "Japão": "Japan", "China": "China", "Canadá": "Canada",
  "Suíça": "Switzerland", "Países Baixos": "Netherlands", "Holanda": "Netherlands",
};

const ALL_COUNTRIES = Country.getAllCountries();

export function resolveCountry(name?: string | null) {
  if (!name) return undefined;
  const target = COUNTRY_NAME_ALIASES[name] || name;
  return ALL_COUNTRIES.find((c) => c.name.toLowerCase() === target.toLowerCase());
}

function formatDdi(phonecode?: string) {
  if (!phonecode) return "+55";
  const t = phonecode.trim();
  return t.startsWith("+") ? t : `+${t}`;
}

const DDI_OPTIONS = Array.from(
  new Map(
    ALL_COUNTRIES.filter((c) => c.phonecode).map((c) => {
      const code = formatDdi(c.phonecode);
      return [code, { code, label: `${c.flag || ""} ${code} ${c.name}`.trim() }];
    })
  ).values()
).sort((a, b) => a.label.localeCompare(b.label));

function Combobox({
  value, options, placeholder, emptyText, disabled, onChange,
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
        <Button type="button" variant="outline" role="combobox" disabled={disabled}
          className="w-full justify-between font-normal">
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
                <CommandItem key={o.value} value={o.label} onSelect={() => { onChange(o.value); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", value === o.value ? "opacity-100" : "opacity-0")} />
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

export const emptyDistributorForm = (): DistributorFormValue => ({
  razao_social: "", nome_fantasia: "", logo_url: "",
  pais: "Brasil", estado: "", cidade: "", endereco: "", cep: "",
  numero_unidades: 1,
  site_url: "", instagram: "", facebook: "", linkedin: "", youtube: "",
  owner_name: "", owner_email: "", owner_whatsapp_ddi: "+55", owner_whatsapp: "",
  buyer_name: "", buyer_email: "", buyer_whatsapp_ddi: "+55", buyer_whatsapp: "",
  active: true, notes: "", authorized_scope: {},
  service_areas: [], linhas_representadas: [], wikidata_id: "", language_preference: "pt",
});

type Props = {
  value: DistributorFormValue;
  onChange: (v: DistributorFormValue) => void;
  /** Show the "Ativo" switch (internal admin only) */
  showActive?: boolean;
  /**
   * Logo handling:
   *  - "upload": upload immediately to Supabase Storage (admin/internal)
   *  - "base64": keep file in memory, parent submits as base64 (public form)
   */
  logoMode?: "upload" | "base64";
  /** Receives File for base64 mode (parent decides what to do with it) */
  onLogoFileChange?: (file: File | null) => void;
};

export function DistributorForm({
  value, onChange, showActive = true, logoMode = "upload", onLogoFileChange,
}: Props) {
  const form = value;
  const setForm = (updater: (f: DistributorFormValue) => DistributorFormValue) =>
    onChange(updater(form));

  const [catalogTaxonomy, setCatalogTaxonomy] = useState<Record<string, string[]>>({});
  // Mapa: categoria → subcategoria ("" = sem sub) → Set<linha>
  const [linesIndex, setLinesIndex] = useState<Record<string, Record<string, string[]>>>({});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [localLogoPreview, setLocalLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("system_a_catalog")
        .select("name, product_category, product_subcategory")
        .eq("active", true).eq("approved", true).eq("visible_in_ui", true)
        .not("product_category", "is", null);
      const map: Record<string, Set<string>> = {};
      const lines: Record<string, Record<string, Set<string>>> = {};
      (data || []).forEach((r: any) => {
        const canon = normCat(r.product_category);
        if (!canon) return;
        if (!map[canon]) map[canon] = new Set<string>();
        const sub = (r.product_subcategory || "").trim();
        if (sub) map[canon].add(sub);
        const line = extractLine(r.name || "");
        if (!line) return;
        if (!lines[canon]) lines[canon] = {};
        const key = sub || "__all__";
        if (!lines[canon][key]) lines[canon][key] = new Set<string>();
        lines[canon][key].add(line);
      });
      const out: Record<string, string[]> = {};
      CANONICAL_CATS.forEach((c) => {
        out[c] = Array.from(map[c] || []).sort((a, b) => a.localeCompare(b, "pt-BR"));
      });
      setCatalogTaxonomy(out);
      const linesOut: Record<string, Record<string, string[]>> = {};
      Object.entries(lines).forEach(([cat, subs]) => {
        linesOut[cat] = {};
        Object.entries(subs).forEach(([sub, set]) => {
          linesOut[cat][sub] = Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
        });
      });
      setLinesIndex(linesOut);
    })();
  }, []);

  const handleCountryChange = (pais: string) => {
    const country = resolveCountry(pais);
    const ddi = formatDdi(country?.phonecode);
    const lang = languageForCountry(country?.isoCode);
    const allStates = country
      ? State.getStatesOfCountry(country.isoCode).map((s) => s.name)
      : [];
    setForm((f) => ({
      ...f, pais, estado: "", cidade: "",
      owner_whatsapp_ddi: f.owner_whatsapp_ddi || ddi,
      buyer_whatsapp_ddi: f.buyer_whatsapp_ddi || ddi,
      language_preference: lang,
      service_areas: allStates,
    }));
  };

  // Linhas derivadas da Autorização Comercial — recalcula a cada mudança.
  const derivedLines = useMemo(() => {
    const scope = (form.authorized_scope || {}) as AuthorizedScope;
    const acc = new Set<string>();
    Object.entries(scope || {}).forEach(([cat, subs]) => {
      const subMap = linesIndex[cat] || {};
      const subsArr = Array.isArray(subs) ? subs : [];
      const list = subsArr.length ? subsArr : Object.keys(subMap);
      (Array.isArray(list) ? list : []).forEach((sub) => {
        const bySub = subMap[sub];
        if (Array.isArray(bySub)) bySub.forEach((l) => acc.add(l));
        const byAll = subMap["__all__"];
        if (Array.isArray(byAll)) byAll.forEach((l) => acc.add(l));
      });
    });
    return Array.from(acc).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [form.authorized_scope, linesIndex]);

  // Sincroniza linhas_representadas com o valor derivado.
  useEffect(() => {
    const current = (form.linhas_representadas || []).join("|");
    const next = derivedLines.join("|");
    if (current !== next) {
      setForm((f) => ({ ...f, linhas_representadas: derivedLines }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedLines]);

  // Garante service_areas e language_preference quando país já existe (edição).
  useEffect(() => {
    const country = resolveCountry(form.pais);
    if (!country) return;
    const updates: Partial<DistributorFormValue> = {};
    if (!form.service_areas || form.service_areas.length === 0) {
      updates.service_areas = State.getStatesOfCountry(country.isoCode).map((s) => s.name);
    }
    const expectedLang = languageForCountry(country.isoCode);
    if (!form.language_preference) {
      updates.language_preference = expectedLang;
    }
    if (Object.keys(updates).length) {
      setForm((f) => ({ ...f, ...updates }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.pais]);

  const handleLogoFile = async (file: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Logo deve ter no máximo 5MB"); return; }
    if (logoMode === "base64") {
      onLogoFileChange?.(file);
      const reader = new FileReader();
      reader.onload = () => setLocalLogoPreview(reader.result as string);
      reader.readAsDataURL(file);
      setForm((f) => ({ ...f, logo_url: "__pending__" }));
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

  const previewLogoUrl =
    form.logo_url === "__pending__" ? localLogoPreview : (form.logo_url || null);

  return (
    <div className="space-y-6 py-2">
      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Identificação</h4>
        <div>
          <Label>Logo da empresa</Label>
          <div className="flex items-center gap-3 mt-2">
            {previewLogoUrl ? (
              <div className="relative">
                <img src={previewLogoUrl} alt="Logo" className="w-20 h-20 rounded border object-contain bg-muted" />
                <button
                  type="button"
                  onClick={() => {
                    setLocalLogoPreview(null);
                    onLogoFileChange?.(null);
                    setForm((f) => ({ ...f, logo_url: "" }));
                  }}
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
                id="dist-logo-upload-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); e.target.value = ""; }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploadingLogo}
                onClick={() => document.getElementById("dist-logo-upload-input")?.click()}
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
            <Input value={form.razao_social || ""} onChange={(e) => setForm((f) => ({ ...f, razao_social: e.target.value }))} />
          </div>
          <div>
            <Label>Nome Fantasia</Label>
            <Input value={form.nome_fantasia || ""} onChange={(e) => setForm((f) => ({ ...f, nome_fantasia: e.target.value }))} />
          </div>
        </div>
        {showActive && (
          <div className="flex items-center gap-2">
            <Switch checked={form.active ?? true} onCheckedChange={(v) => setForm((f) => ({ ...f, active: v }))} />
            <Label>Ativo</Label>
          </div>
        )}
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
              options={ALL_COUNTRIES.map((c) => ({ value: c.name, label: `${c.flag || ""} ${c.name}`.trim() }))}
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
              onChange={(v) => setForm((f) => ({ ...f, estado: v, cidade: "" }))}
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
                onChange={(v) => setForm((f) => ({ ...f, cidade: v }))}
              />
            ) : (
              <Input value={form.cidade || ""} onChange={(e) => setForm((f) => ({ ...f, cidade: e.target.value }))} placeholder="Digite a cidade" />
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Label>Endereço Completo</Label>
            <Input value={form.endereco || ""} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} />
          </div>
          <div>
            <Label>CEP / Código Postal</Label>
            <Input value={form.cep || ""} onChange={(e) => setForm((f) => ({ ...f, cep: e.target.value }))} />
          </div>
        </div>
        <div>
          <Label>Número de Unidades / Filiais</Label>
          <Input type="number" min={1} value={form.numero_unidades ?? 1}
            onChange={(e) => setForm((f) => ({ ...f, numero_unidades: Number(e.target.value) || 1 }))} />
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Presença Digital</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Site Oficial (URL)</Label>
            <Input value={form.site_url || ""} onChange={(e) => setForm((f) => ({ ...f, site_url: e.target.value }))} placeholder="https://…" />
          </div>
          <div>
            <Label>Instagram</Label>
            <Input value={form.instagram || ""} onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))} placeholder="@ ou URL" />
          </div>
          <div>
            <Label>Facebook</Label>
            <Input value={form.facebook || ""} onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))} />
          </div>
          <div>
            <Label>LinkedIn da empresa</Label>
            <Input value={form.linkedin || ""} onChange={(e) => setForm((f) => ({ ...f, linkedin: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>Canal YouTube</Label>
            <Input value={form.youtube || ""} onChange={(e) => setForm((f) => ({ ...f, youtube: e.target.value }))} />
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Contato — Proprietário / Diretor</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.owner_name || ""} onChange={(e) => setForm((f) => ({ ...f, owner_name: e.target.value }))} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.owner_email || ""} onChange={(e) => setForm((f) => ({ ...f, owner_email: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>WhatsApp</Label>
            <div className="flex gap-2">
              <Select value={form.owner_whatsapp_ddi || "+55"} onValueChange={(v) => setForm((f) => ({ ...f, owner_whatsapp_ddi: v }))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DDI_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="flex-1" value={form.owner_whatsapp || ""} onChange={(e) => setForm((f) => ({ ...f, owner_whatsapp: e.target.value }))} placeholder="Número" />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h4 className="text-sm font-semibold">Contato — Responsável de Compras</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Nome</Label>
            <Input value={form.buyer_name || ""} onChange={(e) => setForm((f) => ({ ...f, buyer_name: e.target.value }))} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={form.buyer_email || ""} onChange={(e) => setForm((f) => ({ ...f, buyer_email: e.target.value }))} />
          </div>
          <div className="md:col-span-2">
            <Label>WhatsApp</Label>
            <div className="flex gap-2">
              <Select value={form.buyer_whatsapp_ddi || "+55"} onValueChange={(v) => setForm((f) => ({ ...f, buyer_whatsapp_ddi: v }))}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DDI_OPTIONS.map((o) => <SelectItem key={o.code} value={o.code}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input className="flex-1" value={form.buyer_whatsapp || ""} onChange={(e) => setForm((f) => ({ ...f, buyer_whatsapp: e.target.value }))} placeholder="Número" />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <Label>Observações</Label>
        <Textarea rows={3} value={form.notes || ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-semibold">Autorização Comercial</h4>
            <p className="text-xs text-muted-foreground">Categorias e subcategorias que esta revenda está autorizada a comercializar.</p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button" variant="ghost" size="sm"
              onClick={() => {
                const all: AuthorizedScope = {};
                CANONICAL_CATS.forEach((c) => { all[c] = [...(catalogTaxonomy[c] || [])]; });
                setForm((f) => ({ ...f, authorized_scope: all }));
              }}
            >Selecionar tudo</Button>
            <Button
              type="button" variant="ghost" size="sm"
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
              if (on) next[cat] = []; else delete next[cat];
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
                        <Checkbox checked={selectedSubs.includes(sub)} onCheckedChange={() => toggleSub(sub)} />
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

      <section className="space-y-3">
        <div>
          <h4 className="text-sm font-semibold">SEO / GEO &amp; IA</h4>
          <p className="text-xs text-muted-foreground">
            Estes campos alimentam o schema.org da página pública do distribuidor e o RAG da Dra. LIA.
          </p>
        </div>
        <div>
          <Label>Regiões / cidades atendidas (separadas por vírgula)</Label>
          <div className="rounded-md border bg-muted/40 p-3 min-h-[44px]">
            {(form.service_areas || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Selecione um país para preencher automaticamente todas as regiões.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {(form.service_areas || []).map((s) => (
                  <Badge key={s} variant="secondary" className="font-normal">{s}</Badge>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Cobertura nacional preenchida automaticamente pelo país selecionado. Vira <code>areaServed</code> no schema.org.
          </p>
        </div>
        <div>
          <Label>Linhas Smart Dent representadas (separadas por vírgula)</Label>
          <div className="rounded-md border bg-muted/40 p-3 min-h-[44px]">
            {(form.linhas_representadas || []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Marque categorias e subcategorias em <strong>Autorização Comercial</strong> para preencher automaticamente.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {(form.linhas_representadas || []).map((l) => (
                  <Badge key={l} variant="secondary" className="font-normal">{l}</Badge>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Calculado a partir da Autorização Comercial. Vira <code>makesOffer</code> no schema.org.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label>Wikidata ID (opcional)</Label>
            <Input
              value={form.wikidata_id || ""}
              onChange={(e) => setForm((f) => ({ ...f, wikidata_id: e.target.value.trim() }))}
              placeholder="Q12345678"
            />
          </div>
          <div>
            <Label>Idioma preferencial da página</Label>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              {LANG_LABEL[form.language_preference || "pt"] || "Português"}
              <span className="text-[10px] text-muted-foreground ml-2">(definido automaticamente pelo país)</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}