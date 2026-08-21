import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Link2,
  Plus,
  Pencil,
  Trash2,
  ExternalLink,
  Copy,
  ChevronsUpDown,
  ArrowUp,
  ArrowDown,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { getPublicOrigin } from "@/utils/publicOrigin";
import {
  useBioPages,
  useBioSourceOptions,
  useSaveBioPage,
  useDeleteBioPage,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_LOGO_URL,
  type BioPage,
  type BioItem,
  type BioSocialLinks,
} from "@/hooks/useBioPages";

function slugify(v: string) {
  return v
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface EditorState {
  id?: string;
  slug: string;
  title: string;
  subtitle: string;
  logo_url: string;
  social_links: BioSocialLinks;
  items: BioItem[];
  active: boolean;
}

function emptyEditor(): EditorState {
  return {
    slug: "",
    title: "Smart Dent | Fluxo Digital",
    subtitle: "Escolha abaixo o que você procura",
    logo_url: DEFAULT_LOGO_URL,
    social_links: { ...DEFAULT_SOCIAL_LINKS },
    items: [],
    active: true,
  };
}

function fromPage(p: BioPage): EditorState {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    subtitle: p.subtitle ?? "",
    logo_url: p.logo_url ?? DEFAULT_LOGO_URL,
    social_links: { ...DEFAULT_SOCIAL_LINKS, ...(p.social_links ?? {}) },
    items: p.items ?? [],
    active: p.active,
  };
}

const SOCIAL_FIELDS: Array<{ key: keyof BioSocialLinks; label: string }> = [
  { key: "instagram", label: "Instagram" },
  { key: "youtube", label: "YouTube" },
  { key: "facebook", label: "Facebook" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "website", label: "Site" },
];

export function BioLinkPanel() {
  const { data: pages, isLoading } = useBioPages();
  const { data: sources } = useBioSourceOptions();
  const save = useSaveBioPage();
  const del = useDeleteBioPage();

  const [editor, setEditor] = useState<EditorState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerKind, setPickerKind] = useState<"all" | "form" | "landing_page">("all");

  const filteredSources = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return (sources ?? [])
      .filter((s) => (pickerKind === "all" ? true : s.kind === pickerKind))
      .filter((s) => (!q ? true : `${s.label} ${s.slug}`.toLowerCase().includes(q)))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
  }, [sources, pickerSearch, pickerKind]);


  const publicUrl = (slug: string) => `${getPublicOrigin()}/bio/${slug}`;

  const toggleSource = (key: string) => {
    if (!editor) return;
    const exists = editor.items.find((i) => i.id === key);
    if (exists) {
      setEditor({ ...editor, items: editor.items.filter((i) => i.id !== key) });
      return;
    }
    const src = (sources ?? []).find((s) => s.key === key);
    if (!src) return;
    const item: BioItem = {
      id: src.key,
      kind: src.kind,
      label: src.label,
      description: src.description,
      image_url: src.image_url,
      url: src.url,
      button_text: src.kind === "landing_page" ? "Saiba mais" : "Quero participar",
    };
    setEditor({ ...editor, items: [...editor.items, item] });
  };

  const updateItem = (id: string, patch: Partial<BioItem>) => {
    if (!editor) return;
    setEditor({ ...editor, items: editor.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    if (!editor) return;
    const next = [...editor.items];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setEditor({ ...editor, items: next });
  };

  const handleSave = async () => {
    if (!editor) return;
    const slug = slugify(editor.slug || editor.title);
    if (!slug) {
      toast.error("Informe o endereço (slug) da página");
      return;
    }
    try {
      await save.mutateAsync({
        id: editor.id,
        values: {
          slug,
          title: editor.title.trim() || "Smart Dent",
          subtitle: editor.subtitle.trim() || null,
          logo_url: editor.logo_url.trim() || null,
          social_links: Object.fromEntries(
            Object.entries(editor.social_links).filter(([, v]) => !!v && String(v).trim()),
          ) as BioSocialLinks,
          items: editor.items,
          active: editor.active,
        },
      });
      toast.success("Página Link na Bio salva");
      setEditor(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await del.mutateAsync(id);
      toast.success("Página excluída");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao excluir");
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Link na Bio
          </CardTitle>
          <CardDescription>
            Monte uma página pública com os formulários e landing pages selecionados, em 2 colunas, pronta
            para o link da bio do Instagram e compartilhamento.
          </CardDescription>
        </div>
        <Button onClick={() => setEditor(emptyEditor())}>
          <Plus className="mr-2 h-4 w-4" />
          Nova página
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (pages ?? []).length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma página criada ainda.
          </p>
        ) : (
          (pages ?? []).map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{p.title}</span>
                  <Badge variant={p.active ? "default" : "secondary"}>
                    {p.active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Badge variant="outline">{p.items.length} cards</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">/bio/{p.slug}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(publicUrl(p.slug));
                    toast.success("Link copiado");
                  }}
                >
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copiar link
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <a href={`/bio/${p.slug}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Abrir
                  </a>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setEditor(fromPage(p))}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor?.id ? "Editar página" : "Nova página Link na Bio"}</DialogTitle>
            <DialogDescription>
              Selecione os formulários e landing pages que aparecerão como cards.
            </DialogDescription>
          </DialogHeader>

          {editor && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Título</Label>
                  <Input
                    value={editor.title}
                    onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Endereço público (/bio/…)</Label>
                  <Input
                    value={editor.slug}
                    placeholder="smartdent"
                    onChange={(e) => setEditor({ ...editor, slug: e.target.value })}
                    onBlur={(e) => setEditor({ ...editor, slug: slugify(e.target.value) })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Subtítulo</Label>
                  <Input
                    value={editor.subtitle}
                    onChange={(e) => setEditor({ ...editor, subtitle: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Logo (URL)</Label>
                  <Input
                    value={editor.logo_url}
                    onChange={(e) => setEditor({ ...editor, logo_url: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Redes sociais</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SOCIAL_FIELDS.map(({ key, label }) => (
                    <Input
                      key={key}
                      placeholder={label}
                      value={editor.social_links[key] ?? ""}
                      onChange={(e) =>
                        setEditor({
                          ...editor,
                          social_links: { ...editor.social_links, [key]: e.target.value },
                        })
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Cards selecionados ({editor.items.length})</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => sortItems("kind")}>
                      Agrupar por tipo
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => sortItems("label")}>
                      Ordenar A-Z
                    </Button>
                    <Button
                      type="button"
                      variant={pickerOpen ? "secondary" : "default"}
                      size="sm"
                      onClick={() => setPickerOpen((v) => !v)}
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      Adicionar cards
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {pickerOpen && (
                  <div className="rounded-lg border border-border p-2">
                    <div className="mb-2 flex flex-wrap gap-2">
                      {([
                        { k: "all", l: "Todos" },
                        { k: "form", l: "Somente formulários" },
                        { k: "landing_page", l: "Somente landing pages" },
                      ] as const).map(({ k, l }) => (
                        <Button
                          key={k}
                          type="button"
                          size="sm"
                          variant={pickerKind === k ? "default" : "outline"}
                          onClick={() => setPickerKind(k)}
                        >
                          {l}
                        </Button>
                      ))}
                    </div>
                    <Input
                      placeholder="Buscar..."
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      className="mb-2"
                    />
                    <div className="max-h-72 space-y-1 overflow-y-auto">
                      {filteredSources.length === 0 && (
                        <p className="p-2 text-xs text-muted-foreground">
                          Nada encontrado. Ative "Link da Bio" no formulário/landing page e garanta que
                          exista link encurtado.
                        </p>
                      )}
                      {filteredSources.map((s) => {
                        const checked = !!editor.items.find((i) => i.id === s.key);
                        return (
                          <button
                            type="button"
                            key={s.key}
                            onClick={() => toggleSource(s.key)}
                            className="flex w-full items-start gap-2 rounded-md p-2 text-left hover:bg-accent"
                          >
                            <Checkbox checked={checked} className="mt-0.5" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{s.label}</span>
                              <span className="block truncate text-xs text-muted-foreground">
                                {s.kind === "landing_page" ? "Landing page" : "Formulário"} · {s.url}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}


                {editor.items.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    Nenhum card selecionado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {editor.items.map((item, idx) => (
                      <div key={item.id} className="space-y-2 rounded-lg border border-border p-3">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">
                            {item.kind === "landing_page" ? "LP" : "Form"}
                          </Badge>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.url}</span>
                          <Button variant="ghost" size="icon" onClick={() => moveItem(idx, -1)}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => moveItem(idx, 1)}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleSource(item.id)}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Input
                            value={item.label}
                            placeholder="Título do card"
                            onChange={(e) => updateItem(item.id, { label: e.target.value })}
                          />
                          <Input
                            value={item.button_text ?? ""}
                            placeholder="Texto do botão"
                            onChange={(e) => updateItem(item.id, { button_text: e.target.value })}
                          />
                          <Input
                            value={item.image_url ?? ""}
                            placeholder="URL da imagem"
                            onChange={(e) => updateItem(item.id, { image_url: e.target.value })}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={editor.active}
                  onCheckedChange={(v) => setEditor({ ...editor, active: v })}
                />
                <Label>Página ativa (visível publicamente)</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}