import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Check, ChevronsUpDown, ExternalLink, CalendarDays, Monitor, Users } from "lucide-react";
import { Country } from "country-state-city";
import { cn } from "@/lib/utils";
import CoverImageUpload from "@/components/smartops/CoverImageUpload";
import { EventWebResearchButton, EventReferenceUploads, EventAboutByLanguage, EventCoverByLanguage } from "@/components/smartops/events/EventAIPanels";
import EventAudienceFields from "@/components/smartops/events/EventAudienceFields";
import { EventMarketingArtPanel, type EventMarketingAsset } from "@/components/smartops/events/EventMarketingArtPanel";
import EventSpeakersFields, { type EventSpeaker, type EventPartnerBrand } from "@/components/smartops/events/EventSpeakersFields";
import { CriarPastaEventoDriveButton } from "@/components/smartops/CriarPastaEventoDriveButton";
import { getPublicOrigin } from "@/utils/publicOrigin";

type EventRow = {
  id: string;
  name: string;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  company_stand: string | null;
  website_url: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  display_order: number;
  notes: string | null;
  about_event_pt: string | null;
  about_event_en: string | null;
  about_event_es: string | null;
  cover_image_pt: string | null;
  cover_image_en: string | null;
  cover_image_es: string | null;
  reference_image_url: string | null;
  event_logo_url: string | null;
  ai_image_prompt_pt: string | null;
  ai_image_prompt_en: string | null;
  ai_image_prompt_es: string | null;
  audience_areas: string[] | null;
  audience_specialties: string[] | null;
  audience_notes: string | null;
  speakers: EventSpeaker[] | null;
  days_count: number | null;
  drive_folder_url: string | null;
  partner_brands: EventPartnerBrand[] | null;
  instagram_handle: string | null;
  marketing_art_url: string | null;
  marketing_hero_url: string | null;
  marketing_assets: EventMarketingAsset[] | null;
};

type SellerStat = { seller: string; qtd: number };
type ProductStat = { produto: string; qtd: number };
type AreaStat = { area: string; qtd: number };
type EspecialidadeStat = { especialidade: string; qtd: number };
type EventStats = {
  total_leads: number;
  by_seller: SellerStat[];
  by_product: ProductStat[];
  by_area: AreaStat[];
  by_especialidade: EspecialidadeStat[];
  tem_scanner_sim: number;
  tem_impressora_sim: number;
  imprime_placas_sim: number;
  imprime_modelos_sim: number;
  imprime_nanohibrida_sim: number;
  coupons_discount: number;
  coupons_freight: number;
};

const emptyStats: EventStats = {
  total_leads: 0,
  by_seller: [],
  by_product: [],
  by_area: [],
  by_especialidade: [],
  tem_scanner_sim: 0,
  tem_impressora_sim: 0,
  imprime_placas_sim: 0,
  imprime_modelos_sim: 0,
  imprime_nanohibrida_sim: 0,
  coupons_discount: 0,
  coupons_freight: 0,
};

const ALL_COUNTRIES = Country.getAllCountries();


function emptyForm(): Partial<EventRow> {
  return {
    name: "",
    country: "",
    start_date: "",
    end_date: "",
    start_time: "08:00",
    end_time: "19:00",
    location: "",
    company_stand: "",
    website_url: "",
    cover_image_url: "",
    is_active: true,
    display_order: 0,
    notes: "",
    about_event_pt: "",
    about_event_en: "",
    about_event_es: "",
    cover_image_pt: "",
    cover_image_en: "",
    cover_image_es: "",
    reference_image_url: "",
    event_logo_url: "",
    ai_image_prompt_pt: "",
    ai_image_prompt_en: "",
    ai_image_prompt_es: "",
    audience_areas: [],
    audience_specialties: [],
    audience_notes: "",
    speakers: [],
    days_count: 1,
    partner_brands: [],
    instagram_handle: "",
    marketing_art_url: "",
    marketing_hero_url: "",
    marketing_assets: [],
  };
}

function fmtRange(start?: string | null, end?: string | null) {
  if (!start && !end) return "—";
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  if (start && end && start !== end) return `${fmt(start)} → ${fmt(end)}`;
  return fmt((start || end)!);
}

export function SmartOpsEvents() {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<EventRow> | null>(null);
  const [saving, setSaving] = useState(false);
  const [countryOpen, setCountryOpen] = useState(false);

  const [stats, setStats] = useState<Record<string, EventStats>>({});

  async function loadStats() {
    const [{ data: leadStats }, { data: tables }] = await Promise.all([
      (supabase as any).rpc("fn_event_lead_stats", { p_event_id: null }),
      (supabase as any)
        .from("promotional_tables")
        .select("id, event_id, promotional_coupons(id, free_shipping)")
        .not("event_id", "is", null),
    ]);
    const map: Record<string, EventStats> = {};
    for (const s of (leadStats || []) as any[]) {
      map[s.event_id] = {
        total_leads: Number(s.total_leads) || 0,
        by_seller: (s.by_seller || []) as SellerStat[],
        by_product: (s.by_product || []) as ProductStat[],
        by_area: (s.by_area || []) as AreaStat[],
        by_especialidade: (s.by_especialidade || []) as EspecialidadeStat[],
        tem_scanner_sim: Number(s.tem_scanner_sim) || 0,
        tem_impressora_sim: Number(s.tem_impressora_sim) || 0,
        imprime_placas_sim: Number(s.imprime_placas_sim) || 0,
        imprime_modelos_sim: Number(s.imprime_modelos_sim) || 0,
        imprime_nanohibrida_sim: Number(s.imprime_nanohibrida_sim) || 0,
        coupons_discount: 0,
        coupons_freight: 0,
      };
    }
    for (const t of (tables || []) as any[]) {
      const cur = map[t.event_id] || { ...emptyStats };
      for (const c of (t.promotional_coupons || []) as any[]) {
        if (c.free_shipping) cur.coupons_freight += 1;
        else cur.coupons_discount += 1;
      }
      map[t.event_id] = cur;
    }
    setStats(map);
  }

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("smartops_events")
      .select("*")
      .order("display_order", { ascending: true })
      .order("start_date", { ascending: true, nullsFirst: false });
    if (error) toast.error(error.message);
    setRows((data || []) as unknown as EventRow[]);
    setLoading(false);
    loadStats().catch(() => {});
  }

  useEffect(() => { load(); }, []);


  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.name, r.country, r.location, r.company_stand].filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
    );
  }, [rows, q]);

  function openNew() {
    setEditing(emptyForm());
    setOpen(true);
  }

  function openEdit(row: EventRow) {
    setEditing({ ...row });
    setOpen(true);
  }

  async function handleSave() {
    if (!editing?.name?.trim()) {
      toast.error("Nome do evento é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        name: editing.name.trim(),
        country: editing.country || null,
        start_date: editing.start_date || null,
        end_date: editing.end_date || null,
        start_time: (editing.start_time || "08:00").slice(0, 5),
        end_time: (editing.end_time || "19:00").slice(0, 5),
        location: editing.location || null,
        company_stand: editing.company_stand || null,
        website_url: editing.website_url || null,
        cover_image_url: editing.cover_image_url || null,
        is_active: editing.is_active ?? true,
        display_order: editing.display_order ?? 0,
        notes: editing.notes || null,
        about_event_pt: editing.about_event_pt || null,
        about_event_en: editing.about_event_en || null,
        about_event_es: editing.about_event_es || null,
        cover_image_pt: editing.cover_image_pt || null,
        cover_image_en: editing.cover_image_en || null,
        cover_image_es: editing.cover_image_es || null,
        reference_image_url: editing.reference_image_url || null,
        event_logo_url: editing.event_logo_url || null,
        ai_image_prompt_pt: editing.ai_image_prompt_pt || null,
        ai_image_prompt_en: editing.ai_image_prompt_en || null,
        ai_image_prompt_es: editing.ai_image_prompt_es || null,
        audience_areas: editing.audience_areas ?? [],
        audience_specialties: editing.audience_specialties ?? [],
        audience_notes: editing.audience_notes || null,
        speakers: (editing.speakers ?? []).filter((s) => (s?.name || "").trim() || (s?.theme || "").trim()),
        partner_brands: (editing.partner_brands ?? []).filter((b) => (b?.name || "").trim() || (b?.instagram || "").trim()),
        instagram_handle: editing.instagram_handle || null,
        days_count: Math.max(1, Math.min(10, Number(editing.days_count) || 1)),
        marketing_art_url: editing.marketing_art_url || null,
        marketing_hero_url: editing.marketing_hero_url || null,
      };
      if (editing.id) {
        const { error } = await supabase.from("smartops_events").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Evento atualizado");
      } else {
        const { data: inserted, error } = await supabase.from("smartops_events").insert(payload).select("id").single();
        if (error) throw error;
        // Mantém o diálogo aberto com o id real para permitir gerar IA na sequência.
        if (inserted?.id) setEditing((cur) => cur ? { ...cur, id: inserted.id } as any : cur);
        toast.success("Evento criado");
      }
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: EventRow) {
    if (!confirm(`Excluir evento "${row.name}"?`)) return;
    const { error } = await supabase.from("smartops_events").delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Evento excluído");
    await load();
  }

  async function toggleActive(row: EventRow) {
    const { error } = await supabase.from("smartops_events").update({ is_active: !row.is_active }).eq("id", row.id);
    if (error) return toast.error(error.message);
    await load();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2"><CalendarDays className="w-5 h-5" /> Eventos</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">Congressos, treinamentos externos e eventos onde a Smart Dent participa.</p>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo evento</Button>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Buscar por nome, país, localização..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="mb-4 max-w-md"
          />
          {loading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Nenhum evento cadastrado.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {filtered.map((r) => {
                const st = stats[r.id];
                const sellers = st?.by_seller ?? [];
                const produtos = st?.by_product ?? [];
                const areas = st?.by_area ?? [];
                const especialidades = st?.by_especialidade ?? [];
                const perfil: { label: string; qtd: number }[] = st
                  ? [
                      { label: "Tem scanner", qtd: st.tem_scanner_sim },
                      { label: "Tem impressora", qtd: st.tem_impressora_sim },
                      { label: "Imprime placa", qtd: st.imprime_placas_sim },
                      { label: "Imprime modelo", qtd: st.imprime_modelos_sim },
                      { label: "Imprime nanohíbrida", qtd: st.imprime_nanohibrida_sim },
                    ]
                  : [];
                return (
                  <div key={r.id} className="rounded-lg border bg-card overflow-hidden flex flex-col">
                    <div className="aspect-video bg-muted">
                      {r.cover_image_url ? (
                        <img src={r.cover_image_url} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                          <CalendarDays className="w-8 h-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-2 flex-1">
                      <div className="font-semibold leading-tight">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{fmtRange(r.start_date, r.end_date)}</div>
                      <div className="text-xs text-muted-foreground">
                        {[r.location, r.country].filter(Boolean).join(" — ") || "—"}
                      </div>
                      <div className="flex flex-wrap items-center gap-1">
                        {r.company_stand && <Badge variant="secondary">Estande {r.company_stand}</Badge>}
                        {!!st?.coupons_discount && <Badge variant="outline">{st.coupons_discount} cupons desconto</Badge>}
                        {!!st?.coupons_freight && <Badge variant="outline">{st.coupons_freight} cupons frete</Badge>}
                      </div>

                      <div className="rounded-md bg-muted/50 p-2">
                        <div className="text-[11px] uppercase text-muted-foreground">Leads gerados</div>
                        <div className="text-2xl font-bold leading-none">{st?.total_leads ?? 0}</div>
                      </div>

                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground mb-1">Leads por vendedor no estande</div>
                        {sellers.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum lead registrado.</p>
                        ) : (
                          <ul className="space-y-0.5">
                            {sellers.slice(0, 5).map((s) => (
                              <li key={s.seller} className="flex justify-between gap-2 text-xs">
                                <span className="truncate">{s.seller}</span>
                                <span className="font-semibold tabular-nums">{s.qtd}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground mb-1">Produtos de interesse</div>
                        {produtos.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum produto informado.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {produtos.slice(0, 5).map((p) => (
                              <Badge key={p.produto} variant="secondary" className="text-[10px] font-normal">
                                {p.produto} · {p.qtd}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground mb-1">Área de atuação</div>
                        {areas.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Não informado.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {areas.slice(0, 4).map((a) => (
                              <Badge key={a.area} variant="outline" className="text-[10px] font-normal">
                                {a.area} · {a.qtd}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground mb-1">Especialidade</div>
                        {especialidades.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Não informado.</p>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {especialidades.slice(0, 4).map((e) => (
                              <Badge key={e.especialidade} variant="outline" className="text-[10px] font-normal">
                                {e.especialidade} · {e.qtd}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-[11px] uppercase text-muted-foreground mb-1">Perfil de impressão</div>
                        {perfil.every((p) => p.qtd === 0) ? (
                          <p className="text-xs text-muted-foreground">Nenhum lead com esse perfil.</p>
                        ) : (
                          <ul className="space-y-0.5">
                            {perfil.map((p) => (
                              <li key={p.label} className="flex justify-between gap-2 text-xs">
                                <span className="truncate">{p.label}</span>
                                <span className="font-semibold tabular-nums">{p.qtd}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="mt-auto flex items-center justify-between gap-1 pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                          {r.website_url && (
                            <a href={r.website_url} target="_blank" rel="noopener" className="text-primary" title="Site do evento">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Autoagendamento dos KOLs (link para o grupo de WhatsApp)"
                            onClick={() => {
                              const url = `${getPublicOrigin()}/agenda-kol/${r.id}`;
                              navigator.clipboard?.writeText(url);
                              toast.success("Link de autoagendamento copiado", { description: url });
                              window.open(url, "_blank", "noopener");
                            }}
                          >
                            <Users className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            title="Copiar link da TV (agenda de demonstrações)"
                            onClick={() => {
                              const url = `${getPublicOrigin()}/agenda-tv/${r.id}`;
                              navigator.clipboard?.writeText(url);
                              toast.success("Link da TV copiado", { description: url });
                              window.open(url, "_blank", "noopener");
                            }}
                          >
                            <Monitor className="w-4 h-4" />
                          </Button>
                          <CriarPastaEventoDriveButton eventId={r.id} folderUrl={r.drive_folder_url} />
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div>
                <Label>Nome do evento *</Label>
                <Input value={editing.name || ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>País</Label>
                  <Popover open={countryOpen} onOpenChange={setCountryOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {editing.country || "Selecione..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0 bg-popover z-50">
                      <Command>
                        <CommandInput placeholder="Buscar país..." />
                        <CommandList>
                          <CommandEmpty>Não encontrado.</CommandEmpty>
                          <CommandGroup>
                            {ALL_COUNTRIES.map((c) => (
                              <CommandItem
                                key={c.isoCode}
                                value={c.name}
                                onSelect={() => { setEditing({ ...editing, country: c.name }); setCountryOpen(false); }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", editing.country === c.name ? "opacity-100" : "opacity-0")} />
                                {c.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Localização (cidade / venue)</Label>
                  <Input value={editing.location || ""} onChange={(e) => setEditing({ ...editing, location: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de início</Label>
                  <Input type="date" value={editing.start_date || ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} />
                </div>
                <div>
                  <Label>Hora de início (por dia)</Label>
                  <Input
                    type="time"
                    step={3600}
                    value={(editing.start_time || "08:00").slice(0, 5)}
                    onChange={(e) => setEditing({ ...editing, start_time: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de fim</Label>
                  <Input type="date" value={editing.end_date || ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
                </div>
                <div>
                  <Label>Hora de fim (por dia)</Label>
                  <Input
                    type="time"
                    step={3600}
                    value={(editing.end_time || "19:00").slice(0, 5)}
                    onChange={(e) => setEditing({ ...editing, end_time: e.target.value })}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A hora de início e fim define a grade de horários liberada na página de agendamento dos KOLs.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantidade de dias do evento</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={editing.days_count ?? 1}
                    onChange={(e) => setEditing({ ...editing, days_count: Number(e.target.value) })}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Define quantas pastas "Dia X" serão criadas no Google Drive.
                  </p>
                </div>
                {editing.id && (
                  <div>
                    <Label>Pasta do evento no Google Drive</Label>
                    <div className="mt-1">
                      <CriarPastaEventoDriveButton
                        eventId={editing.id}
                        folderUrl={editing.drive_folder_url}
                        onCreated={(url) => setEditing((cur) => (cur ? { ...cur, drive_folder_url: url } : cur))}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Salve o evento antes: as subpastas seguem palestrantes e dias cadastrados.
                    </p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Stand da empresa</Label>
                  <Input value={editing.company_stand || ""} onChange={(e) => setEditing({ ...editing, company_stand: e.target.value })} placeholder="Ex: Stand A12" />
                </div>
                <div>
                  <Label>Site do evento</Label>
                  <div className="flex items-center gap-2">
                    <Input type="url" value={editing.website_url || ""} onChange={(e) => setEditing({ ...editing, website_url: e.target.value })} placeholder="https://..." />
                    <EventWebResearchButton
                      websiteUrl={editing.website_url || ""}
                      onResult={(ex, meta) => {
                        setEditing((cur) => cur ? {
                          ...cur,
                          name: cur.name || ex?.name || meta?.title || "",
                          start_date: cur.start_date || ex?.start_date || "",
                          end_date: cur.end_date || ex?.end_date || "",
                          location: cur.location || ex?.venue || ex?.location || "",
                          country: cur.country || ex?.country || "",
                          about_event_pt: cur.about_event_pt || ex?.description_pt || "",
                          reference_image_url: cur.reference_image_url || ex?.hero_image_url || meta?.ogImage || "",
                          event_logo_url: cur.event_logo_url || ex?.logo_url || "",
                        } : cur);
                      }}
                    />
                  </div>
                </div>
              </div>

              <EventAudienceFields
                areas={(editing.audience_areas as string[]) || []}
                specialties={(editing.audience_specialties as string[]) || []}
                notes={editing.audience_notes}
                onChange={(patch) => setEditing({ ...editing, ...patch } as any)}
              />

              <EventSpeakersFields
                speakers={(editing.speakers as EventSpeaker[]) || []}
                partnerBrands={(editing.partner_brands as EventPartnerBrand[]) || []}
                instagramHandle={editing.instagram_handle}
                onChange={(patch) => setEditing((cur) => (cur ? ({ ...cur, ...patch } as any) : cur))}
              />

              <div className="space-y-2 border rounded-md p-3">
                <Label className="text-sm font-semibold">Sobre o evento (por idioma)</Label>
                <p className="text-[11px] text-muted-foreground">Usado em Artigos — Ciência & Tecnologia. Sem preços.</p>
                <EventAboutByLanguage
                  eventId={editing.id}
                  values={{ pt: editing.about_event_pt, en: editing.about_event_en, es: editing.about_event_es }}
                  onChange={(lang, v) => setEditing({ ...editing, [`about_event_${lang}`]: v } as any)}
                />
              </div>

              <div className="space-y-2 border rounded-md p-3">
                <Label className="text-sm font-semibold">Mídia de referência (alimenta a IA)</Label>
                <EventReferenceUploads
                  eventId={editing.id}
                  referenceImageUrl={editing.reference_image_url}
                  eventLogoUrl={editing.event_logo_url}
                  onChange={(patch) => setEditing({ ...editing, ...patch } as any)}
                />
              </div>

              <div className="space-y-2 border rounded-md p-3">
                <Label className="text-sm font-semibold">Capa do evento por idioma (16:9 / 1200×675 / ≤5 MB)</Label>
                <p className="text-[11px] text-muted-foreground">A base de conhecimento troca a capa automaticamente conforme o idioma escolhido pelo usuário.</p>
                <EventCoverByLanguage
                  eventId={editing.id}
                  covers={{ pt: editing.cover_image_pt, en: editing.cover_image_en, es: editing.cover_image_es }}
                  referenceImageUrl={editing.reference_image_url}
                  eventLogoUrl={editing.event_logo_url}
                  onCoverChange={(lang, url) => setEditing((cur) => cur ? {
                    ...cur,
                    [`cover_image_${lang}`]: url,
                    ...(lang === "pt" ? { cover_image_url: url || cur.cover_image_url } : {}),
                  } as any : cur)}
                />
                <details className="pt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer">Capa legada (fallback único)</summary>
                  <div className="pt-2">
                    <CoverImageUpload value={editing.cover_image_url || ""} onChange={(url) => setEditing({ ...editing, cover_image_url: url })} />
                  </div>
                </details>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ordem de exibição</Label>
                  <Input type="number" value={editing.display_order ?? 0} onChange={(e) => setEditing({ ...editing, display_order: Number(e.target.value) || 0 })} />
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <Label>Ativo (visível no site)</Label>
                  {editing.id && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = `${getPublicOrigin()}/agenda-kol/${editing.id}`;
                        navigator.clipboard?.writeText(url);
                        toast.success("Link de autoagendamento copiado", { description: url });
                        window.open(url, "_blank", "noopener");
                      }}
                    >
                      <Users className="w-4 h-4 mr-1" /> Autoagendamento KOLs
                    </Button>
                  )}
                </div>
              </div>
              <EventMarketingArtPanel
                eventId={editing.id}
                artUrl={editing.marketing_art_url}
                heroUrl={editing.marketing_hero_url}
                assets={(editing.marketing_assets as EventMarketingAsset[]) || []}
                onChange={(patch) => setEditing((cur) => (cur ? ({ ...cur, ...patch } as any) : cur))}
              />

              <div>
                <Label>Notas internas</Label>
                <Textarea value={editing.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setOpen(false); setEditing(null); }}>Fechar</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SmartOpsEvents;