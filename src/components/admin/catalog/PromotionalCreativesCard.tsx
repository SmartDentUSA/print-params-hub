import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Check, ExternalLink, FolderPlus, Loader2, Save, Sparkles, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

type Creative = { id: string; file_name: string; mime_type: string; storage_url: string | null; drive_url: string | null; description: string; whatsapp_message?: string };

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("promo-creatives", { body });
  if (error) {
    let msg = error.message;
    try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data as T;
}

const toBase64 = (f: File) => new Promise<string>((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(",")[1] ?? "");
  r.onerror = () => rej(r.error);
  r.readAsDataURL(f);
});

export function PromotionalCreativesCard({ table }: { table: { id: string; drive_folder_url?: string | null } }) {
  const [items, setItems] = useState<Creative[]>([]);
  const [folder, setFolder] = useState<string | null>(table.drive_folder_url ?? null);
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ creatives: Creative[] }>({ action: "list", table_id: table.id }).then((r) => setItems(r.creatives)).catch((e) => toast.error(e.message));
    if (!table.drive_folder_url) api<{ table: { drive_folder_url: string } }>({ action: "ensure_folder", table_id: table.id })
      .then((r) => setFolder(r.table.drive_folder_url)).catch((e) => toast.error(`Pasta no Drive: ${e.message}`));
  }, [table.id]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 25 * 1024 * 1024) { toast.error(`${f.name}: acima de 25 MB`); continue; }
        const r = await api<{ creative: Creative }>({ action: "upload", table_id: table.id, file_name: f.name, mime_type: f.type || "application/octet-stream", data_base64: await toBase64(f), description: desc });
        setItems((cur) => [...cur, r.creative]);
        // Mensagem padrão já sai do editor: a IA lê a imagem logo após o envio.
        if (r.creative.mime_type.startsWith("image/")) void generate(r.creative.id);
      }
      setDesc("");
      toast.success("Criativo(s) enviado(s) para a pasta.");
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  };

  const save = async (c: Creative, description: string) => {
    if (description === c.description) return;
    try { await api({ action: "update", id: c.id, description }); setItems((cur) => cur.map((x) => x.id === c.id ? { ...x, description } : x)); toast.success("Descrição salva."); }
    catch (e: any) { toast.error(e.message); }
  };
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  async function generate(id: string) {
    setGenerating((g) => ({ ...g, [id]: true }));
    try {
      const r = await api<{ whatsapp_message: string }>({ action: "generate_message", id });
      setItems((cur) => cur.map((x) => x.id === id ? { ...x, whatsapp_message: r.whatsapp_message } : x));
    } catch (e: any) { toast.error(`Mensagem: ${e.message}`); } finally { setGenerating((g) => ({ ...g, [id]: false })); }
  }
  const saveMessage = async (c: Creative, whatsapp_message: string) => {
    try { await api({ action: "update", id: c.id, whatsapp_message }); setItems((cur) => cur.map((x) => x.id === c.id ? { ...x, whatsapp_message } : x)); toast.success("Mensagem salva."); }
    catch (e: any) { toast.error(e.message); }
  };
  const remove = async (c: Creative) => {
    if (!confirm(`Remover ${c.file_name}?`)) return;
    try { await api({ action: "delete", id: c.id }); setItems((cur) => cur.filter((x) => x.id !== c.id)); } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><CardTitle className="text-base">Criativos da campanha</CardTitle><p className="text-sm text-muted-foreground">Os arquivos vão para a pasta da tabela no Google Drive e aparecem no botão “Criativos” da Agenda.</p></div>
          {folder ? <Button asChild size="sm" variant="outline"><a href={folder} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" />Abrir pasta no Drive</a></Button>
            : <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><FolderPlus className="h-3 w-3" /> Criando pasta…</span>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 rounded-md border p-3">
          <Textarea placeholder="Descrição para uso (ex.: Story para leads de resina, enviar após a apresentação)" value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={2000} />
          <input ref={input} type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={(e) => upload(e.target.files)} />
          <Button onClick={() => input.current?.click()} disabled={busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}Enviar criativos</Button>
        </div>
        <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
          Na Agenda, cada vendedor recebe a mensagem já preenchida: <span className="font-mono">{"{cupom}"}</span> vira o cupom dele nesta tabela, <span className="font-mono">{"{validade_cupom}"}</span> a validade e <span className="font-mono">{"{vendedor}"}</span> o primeiro nome. Se ele não tiver cupom, o parágrafo do cupom sai e fica só “Para equipamentos só me chamar!”.
        </p>
        {!items.length ? <p className="text-sm text-muted-foreground">Nenhum criativo enviado.</p> : (
          <div className="grid gap-3 md:grid-cols-2">
            {items.map((c) => (
              <div key={c.id} className="space-y-2 rounded-md border p-2">
                <CreativeThumb c={c} />
                <p className="truncate text-xs text-muted-foreground" title={c.file_name}>{c.file_name}</p>
                <Textarea defaultValue={c.description} placeholder="Descrição para uso" onBlur={(e) => save(c, e.target.value)} />
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Mensagem para WhatsApp (padrão dos vendedores)</p>
                    <Button size="sm" variant="ghost" onClick={() => generate(c.id)} disabled={generating[c.id]} title="A IA lê a imagem e escreve a mensagem">
                      {generating[c.id] ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}{c.whatsapp_message ? "Gerar de novo" : "Gerar com IA"}
                    </Button>
                  </div>
                  <MessageEditor value={c.whatsapp_message ?? ""} placeholder={generating[c.id] ? "Gerando mensagem…" : "Clique em Gerar com IA ou escreva a mensagem."} onSave={(v) => saveMessage(c, v)} />
                </div>
                <div className="flex justify-between">
                  {c.drive_url ? <Button asChild size="sm" variant="ghost"><a href={c.drive_url} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-1 h-3 w-3" />Drive</a></Button> : <span />}
                  <Button size="icon" variant="ghost" onClick={() => remove(c)} title="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function MessageEditor({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (v: string) => Promise<void> }) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setText(value); }, [value]);
  const dirty = text !== value;
  const save = async () => { if (!dirty) return; setSaving(true); try { await onSave(text); } finally { setSaving(false); } };
  return (
    <div className="space-y-1">
      <Textarea rows={12} className="text-sm leading-relaxed" value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={save} />
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        {saving ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</span> : dirty ? <span>Alterações não salvas</span> : value ? <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" /> Salva</span> : null}
        {dirty && <Button size="sm" variant="secondary" onClick={save} disabled={saving}><Save className="mr-1 h-3 w-3" />Salvar mensagem</Button>}
      </div>
    </div>
  );
}

export function CreativeThumb({ c }: { c: { storage_url: string | null; mime_type: string; file_name: string } }) {
  if (c.storage_url && c.mime_type.startsWith("image/")) return <img src={c.storage_url} alt={c.file_name} className="aspect-square w-full rounded bg-muted object-contain" loading="lazy" />;
  if (c.storage_url && c.mime_type.startsWith("video/")) return <video src={c.storage_url} className="aspect-square w-full rounded bg-muted object-contain" controls preload="metadata" />;
  return <div className="flex aspect-square w-full items-center justify-center rounded bg-muted text-xs text-muted-foreground">{c.file_name}</div>;
}
