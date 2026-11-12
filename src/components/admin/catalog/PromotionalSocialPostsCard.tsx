import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Check, ExternalLink, Instagram, Loader2, RefreshCw, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Post = { id: string; caption: string; link: string; cover_url: string | null; published_at: string | null; whatsapp_message: string };

async function api<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("promo-creatives", { body });
  if (error) {
    let msg = error.message;
    try { const b = await (error as any).context?.json?.(); if (b?.error) msg = b.error; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return data as T;
}

const tagsText = (tags: string[] | null | undefined) => (tags ?? []).map((t) => `#${t}`).join(" ");

/** Hashtag da campanha → publicações do Instagram no botão “Social posts” da Agenda. */
export function PromotionalSocialPostsCard({ table }: { table: { id: string; social_hashtags?: string[] | null } }) {
  const [text, setText] = useState(tagsText(table.social_hashtags));
  const [tags, setTags] = useState<string[]>(table.social_hashtags ?? []);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingTags, setSavingTags] = useState(false);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try { const r = await api<{ hashtags: string[]; posts: Post[] }>({ action: "social_list", table_id: table.id }); setTags(r.hashtags); setPosts(r.posts); }
    catch (e: any) { toast.error(e.message); } finally { setLoading(false); }
  };
  useEffect(() => { setText(tagsText(table.social_hashtags)); setTags(table.social_hashtags ?? []); setPosts([]); if (table.social_hashtags?.length) void load(); }, [table.id]);

  const saveTags = async () => {
    setSavingTags(true);
    try {
      const r = await api<{ hashtags: string[] }>({ action: "social_set_hashtags", table_id: table.id, hashtags: text });
      setTags(r.hashtags); setText(tagsText(r.hashtags)); toast.success("Hashtag salva.");
      if (r.hashtags.length) await load(); else setPosts([]);
    } catch (e: any) { toast.error(e.message); } finally { setSavingTags(false); }
  };
  const regenerate = async (p: Post) => {
    setGenerating((g) => ({ ...g, [p.id]: true }));
    try { const r = await api<{ whatsapp_message: string }>({ action: "social_generate", table_id: table.id, post_id: p.id }); setPosts((cur) => cur.map((x) => x.id === p.id ? { ...x, whatsapp_message: r.whatsapp_message } : x)); }
    catch (e: any) { toast.error(`Mensagem: ${e.message}`); } finally { setGenerating((g) => ({ ...g, [p.id]: false })); }
  };
  const saveMessage = async (p: Post, whatsapp_message: string) => {
    try { await api({ action: "social_update", table_id: table.id, post_id: p.id, whatsapp_message }); setPosts((cur) => cur.map((x) => x.id === p.id ? { ...x, whatsapp_message } : x)); toast.success("Mensagem salva."); }
    catch (e: any) { toast.error(e.message); }
  };
  const dirtyTags = text.trim() !== tagsText(tags);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Instagram className="h-4 w-4" /> Social posts da campanha</CardTitle>
        <p className="text-sm text-muted-foreground">Toda publicação do Instagram da Smart Dent com esta hashtag aparece no botão “Social posts” da Agenda, com a mensagem pronta para o vendedor copiar e enviar no WhatsApp.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-2">
            <Label>Hashtag da campanha / evento</Label>
            <Input value={text} placeholder="#black26" maxLength={500} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void saveTags(); }} />
            <p className="text-xs text-muted-foreground">Pode usar mais de uma, separadas por espaço. Só conta a hashtag exata (#black26 não pega #black2026).</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={saveTags} disabled={savingTags || !dirtyTags}>{savingTags ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Salvar hashtag</Button>
            {tags.length > 0 && <Button variant="outline" onClick={load} disabled={loading} title="Buscar publicações novas"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></Button>}
          </div>
        </div>
        <p className="rounded-md bg-muted/40 p-2 text-xs text-muted-foreground">
          A mensagem é escrita pela IA a partir da legenda da publicação (o mesmo texto usado nas campanhas de grupos), com o link da publicação e o bloco do cupom do vendedor no final. Publicações novas recebem a mensagem automaticamente.
        </p>
        {!tags.length ? null : loading && !posts.length ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Buscando publicações e preparando mensagens…</p>
          : !posts.length ? <p className="text-sm text-muted-foreground">Nenhuma publicação do Instagram com {tagsText(tags)} ainda.</p>
          : (
            <div className="grid gap-3 md:grid-cols-2">
              {posts.map((p) => (
                <div key={p.id} className="space-y-2 rounded-md border p-2">
                  <div className="grid grid-cols-[96px_1fr] gap-2">
                    {p.cover_url ? <img src={p.cover_url} alt="Publicação" className="aspect-square w-full rounded bg-muted object-cover" loading="lazy" referrerPolicy="no-referrer" />
                      : <div className="flex aspect-square w-full items-center justify-center rounded bg-muted text-muted-foreground"><Instagram className="h-5 w-5" /></div>}
                    <div className="min-w-0 space-y-1">
                      <p className="text-xs text-muted-foreground">{p.published_at ? new Date(p.published_at).toLocaleDateString("pt-BR") : ""}</p>
                      <p className="line-clamp-3 text-xs">{p.caption}</p>
                      {p.link && <a href={p.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"><ExternalLink className="h-3 w-3" />Abrir publicação</a>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Mensagem para WhatsApp (padrão dos vendedores)</p>
                    <Button size="sm" variant="ghost" onClick={() => regenerate(p)} disabled={generating[p.id]}>
                      {generating[p.id] ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Sparkles className="mr-1 h-3 w-3" />}Gerar de novo
                    </Button>
                  </div>
                  <MessageEditor value={p.whatsapp_message} onSave={(v) => saveMessage(p, v)} />
                </div>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}

function MessageEditor({ value, onSave }: { value: string; onSave: (v: string) => Promise<void> }) {
  const [text, setText] = useState(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setText(value); }, [value]);
  const dirty = text !== value;
  const save = async () => { if (!dirty) return; setSaving(true); try { await onSave(text); } finally { setSaving(false); } };
  return (
    <div className="space-y-1">
      <Textarea rows={10} className="text-sm leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} onBlur={save} />
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        {saving ? <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Salvando…</span> : dirty ? <span>Alterações não salvas</span> : value ? <span className="inline-flex items-center gap-1"><Check className="h-3 w-3" /> Salva</span> : null}
        {dirty && <Button size="sm" variant="secondary" onClick={save} disabled={saving}><Save className="mr-1 h-3 w-3" />Salvar mensagem</Button>}
      </div>
    </div>
  );
}
