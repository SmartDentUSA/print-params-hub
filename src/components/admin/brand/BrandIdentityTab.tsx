import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Copy, Download, Plus, Save, Trash2 } from "lucide-react";

type Color = { name: string; hex: string; role: string };
type Font = { family: string; weights: string; role: string; google?: string };
type Ref = { label: string; url: string };
type Brand = {
  id: string; brand_name: string; palette: Color[]; fonts: Font[]; logos: Ref[]; reference_images: Ref[];
  source_files: Ref[]; taglines: string[]; voice: string; image_style: string; image_avoid: string; updated_at: string;
};

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Mesmo texto que `_shared/brand-identity.ts` injeta nos prompts de imagem. */
function promptPreview(b: Brand) {
  return [
    `PADRÃO DA MARCA ${b.brand_name.toUpperCase()} (obrigatório):`,
    `- Paleta: ${b.palette.map((c) => `${c.name} ${c.hex} (${c.role})`).join("; ")}.`,
    `- Tipografia: ${b.fonts.map((f) => `${f.family} ${f.weights} — ${f.role}`).join("; ")}. Sans-serif geométrica limpa; nunca serifada, condensada ou decorativa.`,
    `- Estilo visual: ${b.image_style}`,
    `- Tom: ${b.voice}`,
    `- Evitar: ${b.image_avoid}`,
  ].join("\n");
}

export function BrandIdentityTab() {
  const [b, setB] = useState<Brand | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("brand_identity_settings" as any).select("*").eq("id", "smartdent").maybeSingle()
      .then(({ data, error }) => { if (error) toast.error("Não foi possível carregar o padrão da marca"); else setB(data as any); });
  }, []);

  if (!b) return <p className="text-sm text-muted-foreground py-8 text-center">Carregando padrão da marca…</p>;

  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setB({ ...b, [k]: v });
  const setColor = (i: number, patch: Partial<Color>) => set("palette", b.palette.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const setFont = (i: number, patch: Partial<Font>) => set("fonts", b.fonts.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  const save = async () => {
    const bad = b.palette.find((c) => !HEX.test(c.hex));
    if (bad) return toast.error(`Cor inválida: ${bad.name || bad.hex}. Use o formato #RRGGBB.`);
    setSaving(true);
    const { id, updated_at, ...rest } = b;
    const { data, error } = await supabase.from("brand_identity_settings" as any).update(rest as any).eq("id", id).select("*").maybeSingle();
    setSaving(false);
    if (error || !data) return toast.error("Não foi salvo. Somente administradores podem alterar o padrão da marca.");
    setB(data as any);
    toast.success("Padrão da marca salvo. As próximas imagens já usam estas regras.");
  };

  const copy = (t: string) => navigator.clipboard.writeText(t).then(() => toast.success("Copiado"));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold">Padrão da marca</h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Identidade visual oficial da {b.brand_name}. Estas cores, fontes e regras de estilo são usadas automaticamente pelo sistema ao criar imagens
            (posts, capas de lives, banners de formulários e materiais de turmas).
          </p>
          <p className="text-xs text-muted-foreground mt-1">Atualizado em {new Date(b.updated_at).toLocaleString("pt-BR")}</p>
        </div>
        <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" />{saving ? "Salvando…" : "Salvar"}</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Paleta de cores</CardTitle><CardDescription>Extraída do KV visual. Azul-marinho é a cor principal; laranja só em detalhes.</CardDescription></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex h-16 overflow-hidden rounded-lg border">
            {b.palette.map((c, i) => <div key={i} className="flex-1" style={{ background: HEX.test(c.hex) ? c.hex : undefined }} title={`${c.name} ${c.hex}`} />)}
          </div>
          {b.palette.map((c, i) => (
            <div key={i} className="grid grid-cols-[44px_120px_1fr_2fr_auto] items-center gap-2">
              <input type="color" aria-label={`Cor ${c.name}`} value={HEX.test(c.hex) ? c.hex : "#000000"} onChange={(e) => setColor(i, { hex: e.target.value.toUpperCase() })} className="h-10 w-11 cursor-pointer rounded border bg-transparent" />
              <Input value={c.hex} onChange={(e) => setColor(i, { hex: e.target.value.toUpperCase() })} className="font-mono" />
              <Input value={c.name} onChange={(e) => setColor(i, { name: e.target.value })} placeholder="Nome" />
              <Input value={c.role} onChange={(e) => setColor(i, { role: e.target.value })} placeholder="Uso" />
              <div className="flex">
                <Button variant="ghost" size="icon" onClick={() => copy(c.hex)} aria-label="Copiar cor"><Copy className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => set("palette", b.palette.filter((_, j) => j !== i))} aria-label="Remover cor"><Trash2 className="w-4 h-4" /></Button>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => set("palette", [...b.palette, { name: "Nova cor", hex: "#FFFFFF", role: "" }])}><Plus className="w-4 h-4 mr-1" />Adicionar cor</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Tipografia</CardTitle><CardDescription>Fontes usadas no KV, já carregadas no sistema.</CardDescription></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {b.fonts.map((f, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-3">
              <div style={{ fontFamily: `"${f.family}", sans-serif` }}>
                <p className="text-3xl" style={{ fontWeight: 600 }}>{f.family}</p>
                <p className="text-lg" style={{ fontWeight: 300 }}>Soluções de odontologia digital</p>
                <p className="text-sm text-muted-foreground">Aa Bb Cc 0123456789 — Vitality® · Smart Print Bio</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Família</Label><Input value={f.family} onChange={(e) => setFont(i, { family: e.target.value })} /></div>
                <div><Label className="text-xs">Pesos</Label><Input value={f.weights} onChange={(e) => setFont(i, { weights: e.target.value })} /></div>
              </div>
              <div><Label className="text-xs">Uso</Label><Input value={f.role} onChange={(e) => setFont(i, { role: e.target.value })} /></div>
              {f.google && <a href={f.google} target="_blank" rel="noopener" className="text-xs text-primary underline">Ver no Google Fonts</a>}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Logos e referências visuais</CardTitle><CardDescription>Arquivos enviados: KV visual, banner Vitality e posts de referência.</CardDescription></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {b.logos.map((l, i) => (
              <a key={`l${i}`} href={l.url} target="_blank" rel="noopener" className="rounded-lg border bg-muted/40 p-4 flex flex-col items-center gap-2">
                <img src={l.url} alt={l.label} className="h-16 object-contain" loading="lazy" />
                <span className="text-xs text-muted-foreground text-center">{l.label}</span>
              </a>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {b.reference_images.map((r, i) => (
              <a key={`r${i}`} href={r.url} target="_blank" rel="noopener" className="overflow-hidden rounded-lg border">
                <img src={r.url} alt={r.label} className="aspect-video w-full object-cover" loading="lazy" />
                <span className="block px-3 py-2 text-xs text-muted-foreground">{r.label}</span>
              </a>
            ))}
          </div>
          {b.source_files.map((s, i) => (
            <a key={`s${i}`} href={s.url} target="_blank" rel="noopener" download className="inline-flex items-center gap-2 text-sm text-primary underline">
              <Download className="w-4 h-4" />{s.label}
            </a>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Regras para criar imagens e textos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Estilo visual</Label><Textarea rows={6} value={b.image_style} onChange={(e) => set("image_style", e.target.value)} /></div>
          <div><Label>Evitar</Label><Textarea rows={3} value={b.image_avoid} onChange={(e) => set("image_avoid", e.target.value)} /></div>
          <div><Label>Tom de voz</Label><Textarea rows={3} value={b.voice} onChange={(e) => set("voice", e.target.value)} /></div>
          <div><Label>Frases da marca (uma por linha)</Label><Textarea rows={4} value={b.taglines.join("\n")} onChange={(e) => set("taglines", e.target.value.split("\n").map((t) => t.trim()).filter(Boolean))} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div><CardTitle className="text-base">Instrução enviada ao criar imagens</CardTitle><CardDescription>Prévia do texto que acompanha cada pedido de imagem.</CardDescription></div>
          <Button variant="outline" size="sm" onClick={() => copy(promptPreview(b))}><Copy className="w-4 h-4 mr-1" />Copiar</Button>
        </CardHeader>
        <CardContent><pre className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs leading-relaxed">{promptPreview(b)}</pre></CardContent>
      </Card>
    </div>
  );
}
