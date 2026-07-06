import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Link2, RefreshCw, Plus, CornerDownLeft, Pencil, Trash2, Loader2, FileText, Layout } from "lucide-react";

type Channel = "sms" | "whatsapp" | "whatsapp_groups";

interface CampaignLink {
  id: string;
  nome: string;
  url: string;
  url_curta: string | null;
  source: "disparopro" | "manual";
  channels: Channel[];
}

interface Props {
  channel: Channel;
  onInsert: (text: string) => void;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string);

const CHANNEL_LABEL: Record<Channel, string> = {
  sms: "SMS",
  whatsapp: "WhatsApp",
  whatsapp_groups: "Grupos WA",
};

const SHORT_LINK_DOMAIN = "https://s.smartdent.com.br";

interface FormShortLink {
  id: string;
  name: string;
  slug: string;
  short_code: string;
  default_target: "form" | "landing_page";
  url: string;
  click_count: number;
}

async function fetchFormShortLinks(): Promise<FormShortLink[]> {
  const { data: links, error: linksError } = await (supabase as any)
    .from("smartops_short_links")
    .select("short_code, form_slug, default_target, click_count");
  if (linksError || !links) {
    console.error("[fetchFormShortLinks] links", linksError);
    return [];
  }
  const slugs = links.map((l: any) => l.form_slug).filter(Boolean);
  if (slugs.length === 0) return [];
  const { data: forms, error: formsError } = await (supabase as any)
    .from("smartops_forms")
    .select("id, name, slug")
    .in("slug", slugs);
  if (formsError || !forms) {
    console.error("[fetchFormShortLinks] forms", formsError);
    return [];
  }
  const formBySlug = Object.fromEntries((forms as any[]).map((f: any) => [f.slug, f]));
  return (links as any[])
    .map((l: any) => {
      const form = formBySlug[l.form_slug];
      if (!form) return null;
      return {
        id: `${l.form_slug}-${l.default_target}`,
        name: form.name,
        slug: form.slug,
        short_code: l.short_code,
        default_target: l.default_target as "form" | "landing_page",
        click_count: Number(l.click_count) || 0,
        url: `${SHORT_LINK_DOMAIN}/${l.short_code}`,
      };
    })
    .filter(Boolean) as FormShortLink[];
}

async function fetchLinks(channel: Channel): Promise<CampaignLink[]> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? SUPABASE_ANON;
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/disparopro-sync-links?channel=${encodeURIComponent(channel)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON,
      },
    },
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const items = Array.isArray(json) ? json : json?.links ?? json?.data ?? [];
  return items as CampaignLink[];
}

export function CampaignLinkPicker({ channel, onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formLinksLoading, setFormLinksLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [links, setLinks] = useState<CampaignLink[]>([]);
  const [formLinks, setFormLinks] = useState<FormShortLink[]>([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CampaignLink | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      setLinks(await fetchLinks(channel));
    } catch (e: any) {
      toast.error("Falha ao carregar links: " + (e?.message ?? String(e)));
    } finally {
      setLoading(false);
    }
  };

  const loadFormLinks = async () => {
    setFormLinksLoading(true);
    try {
      setFormLinks(await fetchFormShortLinks());
    } catch (e: any) {
      toast.error("Falha ao carregar links de formulários: " + (e?.message ?? String(e)));
    } finally {
      setFormLinksLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      load();
      loadFormLinks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, channel]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("disparopro-sync-links", {
        body: { action: "sync" },
      });
      if (error) throw error;
      const count = (data as any)?.imported ?? (data as any)?.count;
      toast.success(count != null ? `Sincronizado: ${count} links` : "Sincronizado");
      await load();
    } catch (e: any) {
      toast.error("Falha no sync: " + (e?.message ?? String(e)));
    } finally {
      setSyncing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Desativar este link?")) return;
    try {
      const { error } = await supabase.functions.invoke("disparopro-sync-links", {
        body: { action: "delete", id },
      });
      if (error) throw error;
      toast.success("Link removido");
      await load();
    } catch (e: any) {
      toast.error("Falha ao remover: " + (e?.message ?? String(e)));
    }
  };

  const handleInsert = (link: CampaignLink) => {
    onInsert(link.url_curta || link.url);
    setOpen(false);
  };

  const handleInsertFormLink = (link: FormShortLink) => {
    onInsert(link.url);
    setOpen(false);
  };

  const openEditor = (link: CampaignLink | null) => {
    setEditing(link);
    setEditorOpen(true);
  };

  const disparoLinks = links.filter((l) => l.source === "disparopro");
  const manualLinks = links.filter((l) => l.source === "manual");

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" type="button">
            <Link2 className="w-3.5 h-3.5" />
            Links
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[420px] p-0" align="end">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
            <Button
              size="sm"
              variant="ghost"
              onClick={handleSync}
              disabled={syncing}
              type="button"
            >
              {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Sincronizar DisparoPro
            </Button>
            <Button size="sm" variant="outline" onClick={() => openEditor(null)} type="button">
              <Plus className="w-3.5 h-3.5" /> Novo
            </Button>
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : links.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                Nenhum link para este canal.
              </div>
            ) : (
              <>
                {disparoLinks.length > 0 && (
                  <LinkSection
                    label="DisparoPro"
                    badgeVariant="default"
                    links={disparoLinks}
                    onInsert={handleInsert}
                    onEdit={openEditor}
                    onDelete={handleDelete}
                  />
                )}
                {manualLinks.length > 0 && (
                  <LinkSection
                    label="Manual"
                    badgeVariant="secondary"
                    links={manualLinks}
                    onInsert={handleInsert}
                    onEdit={openEditor}
                    onDelete={handleDelete}
                  />
                )}
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <LinkEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        link={editing}
        defaultChannel={channel}
        onSaved={async () => {
          setEditorOpen(false);
          await load();
        }}
      />
    </>
  );
}

function LinkSection({
  label,
  badgeVariant,
  links,
  onInsert,
  onEdit,
  onDelete,
}: {
  label: string;
  badgeVariant: "default" | "secondary";
  links: CampaignLink[];
  onInsert: (l: CampaignLink) => void;
  onEdit: (l: CampaignLink) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="py-1">
      <div className="px-3 py-1.5 flex items-center gap-2 sticky top-0 bg-popover">
        <Badge variant={badgeVariant} className="text-[10px]">{label}</Badge>
        <span className="text-xs text-muted-foreground">{links.length}</span>
      </div>
      <ul className="divide-y">
        {links.map((l) => {
          const display = l.url_curta || l.url;
          const editable = l.source === "manual";
          return (
            <li key={l.id} className="px-3 py-2 flex items-center gap-2 hover:bg-muted/40">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{l.nome}</div>
                <div className="text-xs text-muted-foreground truncate">{display}</div>
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onInsert(l)} type="button" title="Inserir">
                <CornerDownLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => onEdit(l)}
                disabled={!editable}
                type="button"
                title={editable ? "Editar" : "Somente links manuais"}
              >
                <Pencil className="w-3.5 h-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive"
                onClick={() => onDelete(l.id)}
                disabled={!editable}
                type="button"
                title={editable ? "Remover" : "Somente links manuais"}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LinkEditor({
  open,
  onOpenChange,
  link,
  defaultChannel,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  link: CampaignLink | null;
  defaultChannel: Channel;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [urlCurta, setUrlCurta] = useState("");
  const [channels, setChannels] = useState<Channel[]>([defaultChannel]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNome(link?.nome ?? "");
      setUrl(link?.url ?? "");
      setUrlCurta(link?.url_curta ?? "");
      setChannels(link?.channels?.length ? link.channels : [defaultChannel]);
    }
  }, [open, link, defaultChannel]);

  const toggle = (c: Channel) => {
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const save = async () => {
    if (!nome.trim() || !url.trim()) {
      toast.error("Nome e URL são obrigatórios");
      return;
    }
    if (!channels.length) {
      toast.error("Selecione ao menos um canal");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        action: "save",
        link: {
          ...(link?.id ? { id: link.id } : {}),
          nome: nome.trim(),
          url: url.trim(),
          url_curta: urlCurta.trim() || null,
          channels,
        },
      };
      const { error } = await supabase.functions.invoke("disparopro-sync-links", { body: payload });
      if (error) throw error;
      toast.success("Link salvo");
      onSaved();
    } catch (e: any) {
      toast.error("Falha ao salvar: " + (e?.message ?? String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{link ? "Editar link" : "Novo link"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">URL *</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label className="text-xs">URL curta (opcional — link trackado)</Label>
            <Input value={urlCurta} onChange={(e) => setUrlCurta(e.target.value)} placeholder="https://bit.ly/..." />
          </div>
          <div>
            <Label className="text-xs">Disponível em</Label>
            <div className="flex gap-4 mt-1.5">
              {(["sms", "whatsapp", "whatsapp_groups"] as Channel[]).map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={channels.includes(c)} onCheckedChange={() => toggle(c)} />
                  {CHANNEL_LABEL[c]}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} type="button">Cancelar</Button>
          <Button onClick={save} disabled={saving} type="button">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CampaignLinkPicker;