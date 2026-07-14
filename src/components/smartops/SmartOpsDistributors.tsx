import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Globe, Instagram, Facebook, Linkedin, Youtube, MapPin, Building2, Link2, Share2, LayoutGrid, List, Search } from "lucide-react";
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
  const [q, setQ] = useState("");
  const [country, setCountry] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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

  const countries = useMemo(() => {
    const s = new Set<string>();
    items.forEach((d) => { if (d.pais) s.add(d.pais); });
    return Array.from(s).sort();
  }, [items]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items.filter((d) => {
      if (country !== "all" && (d.pais || "") !== country) return false;
      if (status === "active" && !d.active) return false;
      if (status === "inactive" && d.active) return false;
      if (!term) return true;
      const hay = [d.razao_social, d.nome_fantasia, d.cidade, d.estado, d.buyer_name, d.owner_name]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [items, q, country, status]);

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
        <>
        <div className="flex flex-wrap items-center gap-2 border rounded-md p-2 bg-muted/30">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nome, cidade, comprador…"
              className="pl-8 h-9"
            />
          </div>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="País" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os países</SelectItem>
              {countries.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1 border rounded-md p-0.5 bg-background">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              className="h-8 px-2"
              onClick={() => setViewMode("grid")}
              title="Grade"
            ><LayoutGrid className="w-4 h-4" /></Button>
            <Button
              size="sm"
              variant={viewMode === "list" ? "default" : "ghost"}
              className="h-8 px-2"
              onClick={() => setViewMode("list")}
              title="Lista"
            ><List className="w-4 h-4" /></Button>
          </div>
          <span className="text-xs text-muted-foreground ml-auto">
            {filtered.length} de {items.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
            Nenhum distribuidor bate com os filtros aplicados.
          </CardContent></Card>
        ) : viewMode === "list" ? (
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Distribuidor</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Backlink</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((d) => (
                  <TableRow key={d.id} className="cursor-pointer" onClick={() => openEdit(d)}>
                    <TableCell>
                      {d.logo_url ? (
                        <img src={d.logo_url} alt={d.razao_social} className="w-8 h-8 rounded object-contain bg-muted" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium truncate">{d.nome_fantasia || d.razao_social}</div>
                      {d.nome_fantasia && (
                        <div className="text-xs text-muted-foreground truncate">{d.razao_social}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {[d.cidade, d.estado, d.pais].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={d.active ? "default" : "secondary"}>
                        {d.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>{backlinkBadge(d) ?? <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                          <Pencil className="w-3 h-3" />
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
                          <Share2 className="w-3 h-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(d)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((d) => (
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
        </>
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