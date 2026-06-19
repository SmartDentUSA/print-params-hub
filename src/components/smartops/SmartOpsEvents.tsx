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
import { Plus, Pencil, Trash2, Check, ChevronsUpDown, ExternalLink, CalendarDays } from "lucide-react";
import { Country } from "country-state-city";
import { cn } from "@/lib/utils";
import CoverImageUpload from "@/components/smartops/CoverImageUpload";
import { EventWebResearchButton, EventReferenceUploads, EventAboutByLanguage, EventCoverByLanguage } from "@/components/smartops/events/EventAIPanels";

type EventRow = {
  id: string;
  name: string;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
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
};

const ALL_COUNTRIES = Country.getAllCountries();

function emptyForm(): Partial<EventRow> {
  return {
    name: "",
    country: "",
    start_date: "",
    end_date: "",
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

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("smartops_events")
      .select("*")
      .order("display_order", { ascending: true })
      .order("start_date", { ascending: true, nullsFirst: false });
    if (error) toast.error(error.message);
    setRows((data || []) as EventRow[]);
    setLoading(false);
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
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3">Capa</th>
                    <th className="py-2 pr-3">Nome</th>
                    <th className="py-2 pr-3">País</th>
                    <th className="py-2 pr-3">Datas</th>
                    <th className="py-2 pr-3">Local</th>
                    <th className="py-2 pr-3">Stand</th>
                    <th className="py-2 pr-3">Site</th>
                    <th className="py-2 pr-3">Ativo</th>
                    <th className="py-2 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">
                        {r.cover_image_url ? (
                          <img src={r.cover_image_url} alt={r.name} className="w-16 h-10 object-cover rounded border" />
                        ) : (
                          <div className="w-16 h-10 rounded border bg-muted" />
                        )}
                      </td>
                      <td className="py-2 pr-3 font-medium">{r.name}</td>
                      <td className="py-2 pr-3">{r.country || "—"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmtRange(r.start_date, r.end_date)}</td>
                      <td className="py-2 pr-3">{r.location || "—"}</td>
                      <td className="py-2 pr-3">{r.company_stand || "—"}</td>
                      <td className="py-2 pr-3">
                        {r.website_url ? (
                          <a href={r.website_url} target="_blank" rel="noopener" className="text-primary inline-flex items-center gap-1">
                            link <ExternalLink className="w-3 h-3" />
                          </a>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-3">
                        <Switch checked={r.is_active} onCheckedChange={() => toggleActive(r)} />
                      </td>
                      <td className="py-2 pr-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(r)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(r)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                  <Label>Data de fim</Label>
                  <Input type="date" value={editing.end_date || ""} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} />
                </div>
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
                <div className="flex items-end gap-2">
                  <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                  <Label>Ativo (visível no site)</Label>
                </div>
              </div>
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