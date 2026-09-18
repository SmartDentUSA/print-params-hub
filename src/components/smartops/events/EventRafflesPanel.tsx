import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Gift, Sparkles, Copy, ExternalLink, Trophy } from "lucide-react";
import { getPublicOrigin } from "@/utils/publicOrigin";

export type RafflePrize = {
  id: string;
  title: string;
  description?: string;
  quantity?: number;
  image_url?: string;
  sponsor?: string;
};

export type RaffleField = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select" | "radio" | "checkbox" | "number" | "date";
  required?: boolean;
  options?: string[];
  system?: boolean;
};

type RaffleEligibility = {
  require_consent?: boolean;
  require_contact?: boolean;
  require_stand_visit?: boolean;
  require_purchase?: boolean;
  one_entry_per_person?: boolean;
  weights?: { form?: number; stand_visit?: number; demo?: number; purchase?: number; referral?: number };
};

type Raffle = {
  id?: string;
  event_id: string;
  name: string;
  slug: string;
  status: "draft" | "active" | "closed";
  starts_at: string | null;
  ends_at: string | null;
  rules_text: string | null;
  prizes: RafflePrize[];
  form_fields: RaffleField[];
  eligibility: RaffleEligibility;
  draw_mode: "system" | "manual" | "public_audit";
  public_results: boolean;
  notify_winner: boolean;
  notify_group: boolean;
  wa_instance: string | null;
  wa_group_jid: string | null;
  wa_group_name: string | null;
  winner_message_template: string | null;
  group_message_template: string | null;
};

type WaGroup = { id: string; group_jid: string; name: string; instance_name: string | null };
type DrawRow = { id: string; prize_title: string | null; winner_name: string | null; drawn_at: string; participants_count: number };

const SYSTEM_FIELDS: RaffleField[] = [
  { key: "nome", label: "Nome completo", type: "text", required: true, system: true },
  { key: "telefone", label: "WhatsApp", type: "tel", required: true, system: true },
  { key: "email", label: "E-mail", type: "email", required: true, system: true },
  { key: "cidade", label: "Cidade", type: "text", system: true },
  { key: "uf", label: "Estado (UF)", type: "text", system: true },
  { key: "cro", label: "CRO / registro profissional", type: "text", system: true },
  { key: "empresa", label: "Clínica / laboratório", type: "text", system: true },
  { key: "cnpj", label: "CNPJ", type: "text", system: true },
  { key: "area_atuacao", label: "Área de atuação", type: "select", system: true, options: ["Clínica ou Consultório", "Laboratório", "Estudante", "Professor", "Distribuidor"] },
  { key: "especialidade", label: "Especialidade", type: "text", system: true },
  { key: "tem_scanner", label: "Tem scanner?", type: "radio", system: true, options: ["Sim", "Não"] },
  { key: "tem_impressora", label: "Tem impressora 3D?", type: "radio", system: true, options: ["Sim", "Não"] },
  { key: "produto_interesse", label: "Produto de interesse", type: "text", system: true },
  { key: "instagram", label: "Instagram", type: "text", system: true },
];

const uid = () => Math.random().toString(36).slice(2, 9);

const slugify = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function blank(eventId: string, eventName: string): Raffle {
  return {
    event_id: eventId,
    name: `Sorteio — ${eventName}`,
    slug: `${slugify(eventName)}-sorteio`,
    status: "draft",
    starts_at: null,
    ends_at: null,
    rules_text:
      "1. Participação gratuita, sem obrigação de compra.\n2. Um cadastro por pessoa, com WhatsApp válido.\n3. O sorteio será realizado pelo sistema Smart Dent, entre os cadastros válidos.\n4. O ganhador será avisado pelo WhatsApp informado no cadastro.\n5. O prêmio é pessoal e não pode ser trocado por dinheiro.",
    prizes: [{ id: uid(), title: "", description: "", quantity: 1 }],
    form_fields: SYSTEM_FIELDS.filter((f) => ["nome", "telefone", "email", "cidade", "area_atuacao"].includes(f.key)).map((f) => ({ ...f })),
    eligibility: {
      require_consent: true,
      require_contact: true,
      require_stand_visit: false,
      require_purchase: false,
      one_entry_per_person: true,
      weights: { form: 1, stand_visit: 1, demo: 2, purchase: 5, referral: 2 },
    },
    draw_mode: "system",
    public_results: false,
    notify_winner: true,
    notify_group: true,
    wa_instance: null,
    wa_group_jid: null,
    wa_group_name: null,
    winner_message_template:
      "Parabéns, {ganhador}! 🎉 Você foi sorteado no {sorteio} e ganhou: {premio}. Nossa equipe já vai falar com você para combinar a entrega.",
    group_message_template:
      "🎁 Resultado do sorteio *{sorteio}*\nPrêmio: {premio}\nGanhador(a): *{ganhador}*\nParticipantes: {participantes}",
  };
}

const toLocalInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16) : "");

export default function EventRafflesPanel({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [saving, setSaving] = useState(false);
  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [entries, setEntries] = useState(0);
  const [draws, setDraws] = useState<DrawRow[]>([]);
  const [drawing, setDrawing] = useState<string | null>(null);

  const publicUrl = useMemo(() => (raffle?.slug ? `${getPublicOrigin()}/sorteio/${raffle.slug}` : ""), [raffle?.slug]);

  async function load() {
    const [{ data: r }, { data: g }] = await Promise.all([
      (supabase as any).from("event_raffles").select("*").eq("event_id", eventId).order("created_at", { ascending: true }).limit(1).maybeSingle(),
      (supabase as any).from("wa_groups").select("id, group_jid, name, instance_name").eq("enabled", true).order("name"),
    ]);
    setGroups((g || []) as WaGroup[]);
    if (r) {
      setRaffle({
        ...(r as any),
        prizes: Array.isArray(r.prizes) ? r.prizes : [],
        form_fields: Array.isArray(r.form_fields) ? r.form_fields : [],
        eligibility: r.eligibility || {},
      });
      const [{ count }, { data: d }] = await Promise.all([
        (supabase as any).from("event_raffle_entries").select("id", { count: "exact", head: true }).eq("raffle_id", r.id),
        (supabase as any).from("event_raffle_draws").select("id, prize_title, winner_name, drawn_at, participants_count").eq("raffle_id", r.id).order("drawn_at", { ascending: false }),
      ]);
      setEntries(count || 0);
      setDraws((d || []) as DrawRow[]);
    } else {
      setRaffle(null);
      setEntries(0);
      setDraws([]);
    }
  }

  useEffect(() => {
    if (eventId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const patch = (p: Partial<Raffle>) => setRaffle((cur) => (cur ? { ...cur, ...p } : cur));
  const patchRules = (p: Partial<RaffleEligibility>) =>
    setRaffle((cur) => (cur ? { ...cur, eligibility: { ...cur.eligibility, ...p } } : cur));

  async function save() {
    if (!raffle) return;
    if (!raffle.name.trim()) return toast.error("Dê um nome ao sorteio");
    if (!raffle.slug.trim()) return toast.error("Defina o link público do sorteio");
    setSaving(true);
    const row = {
      event_id: eventId,
      name: raffle.name.trim(),
      slug: slugify(raffle.slug),
      status: raffle.status,
      starts_at: raffle.starts_at || null,
      ends_at: raffle.ends_at || null,
      rules_text: raffle.rules_text || null,
      prizes: raffle.prizes.filter((p) => (p.title || "").trim()),
      form_fields: raffle.form_fields,
      eligibility: raffle.eligibility,
      draw_mode: raffle.draw_mode,
      public_results: raffle.public_results,
      notify_winner: raffle.notify_winner,
      notify_group: raffle.notify_group,
      wa_instance: raffle.wa_instance || null,
      wa_group_jid: raffle.wa_group_jid || null,
      wa_group_name: raffle.wa_group_name || null,
      winner_message_template: raffle.winner_message_template || null,
      group_message_template: raffle.group_message_template || null,
    };
    const res = raffle.id
      ? await (supabase as any).from("event_raffles").update(row).eq("id", raffle.id)
      : await (supabase as any).from("event_raffles").insert(row);
    setSaving(false);
    if (res.error) return toast.error("Não foi possível salvar o sorteio", { description: res.error.message });
    toast.success("Sorteio salvo");
    load();
  }

  async function runDraw(prize: RafflePrize) {
    if (!raffle?.id) return toast.error("Salve o sorteio primeiro");
    setDrawing(prize.id);
    const { data, error } = await (supabase as any).functions.invoke("smart-ops-raffle-draw", {
      body: { raffle_id: raffle.id, prize_id: prize.id },
    });
    setDrawing(null);
    if (error || data?.ok === false) {
      return toast.error("Não foi possível sortear", { description: data?.error || error?.message });
    }
    toast.success(`Ganhador: ${data.winner?.name}`, { description: `${data.participants} participantes · ${prize.title}` });
    load();
  }

  if (!raffle) {
    return (
      <div className="border rounded-md p-3 space-y-2">
        <Label className="text-sm font-semibold flex items-center gap-2"><Gift className="w-4 h-4" /> Sorteios</Label>
        <p className="text-[11px] text-muted-foreground">
          Crie um sorteio de brindes para o congresso: prêmios, período, regras, formulário de participação e aviso automático no WhatsApp.
        </p>
        <Button size="sm" variant="outline" onClick={() => setRaffle(blank(eventId, eventName))}>
          <Plus className="w-4 h-4 mr-1" /> Criar sorteio
        </Button>
      </div>
    );
  }

  return (
    <div className="border rounded-md p-3 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-semibold flex items-center gap-2"><Gift className="w-4 h-4" /> Sorteios</Label>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{entries} participante(s)</Badge>
          <Select value={raffle.status} onValueChange={(v) => patch({ status: v as Raffle["status"] })}>
            <SelectTrigger className="h-8 w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Rascunho</SelectItem>
              <SelectItem value="active">Ativo</SelectItem>
              <SelectItem value="closed">Encerrado</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label>Nome do sorteio</Label>
          <Input value={raffle.name} onChange={(e) => patch({ name: e.target.value })} />
        </div>
        <div>
          <Label>Link público</Label>
          <div className="flex items-center gap-1">
            <Input value={raffle.slug} onChange={(e) => patch({ slug: e.target.value })} />
            <Button size="icon" variant="ghost" title="Copiar link" onClick={() => { navigator.clipboard?.writeText(publicUrl); toast.success("Link copiado", { description: publicUrl }); }}>
              <Copy className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" title="Abrir" onClick={() => window.open(publicUrl, "_blank", "noopener")}>
              <ExternalLink className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <div>
          <Label>Início da promoção</Label>
          <Input type="datetime-local" value={toLocalInput(raffle.starts_at)} onChange={(e) => patch({ starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </div>
        <div>
          <Label>Fim da promoção</Label>
          <Input type="datetime-local" value={toLocalInput(raffle.ends_at)} onChange={(e) => patch({ ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
        </div>
      </div>

      {/* Prêmios */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase text-muted-foreground">Prêmios do sorteio</Label>
          <Button size="sm" variant="outline" onClick={() => patch({ prizes: [...raffle.prizes, { id: uid(), title: "", quantity: 1 }] })}>
            <Plus className="w-4 h-4 mr-1" /> Prêmio
          </Button>
        </div>
        {raffle.prizes.map((p, i) => {
          const won = draws.filter((d) => (d.prize_title || "") === p.title);
          return (
            <div key={p.id} className="border rounded-md p-2 space-y-2">
              <div className="grid md:grid-cols-[1fr_90px_auto] gap-2">
                <Input placeholder="Prêmio (ex.: Kit SmartMake)" value={p.title} onChange={(e) => {
                  const prizes = [...raffle.prizes]; prizes[i] = { ...p, title: e.target.value }; patch({ prizes });
                }} />
                <Input type="number" min={1} value={p.quantity ?? 1} onChange={(e) => {
                  const prizes = [...raffle.prizes]; prizes[i] = { ...p, quantity: Number(e.target.value) }; patch({ prizes });
                }} />
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="secondary" disabled={!raffle.id || drawing === p.id} onClick={() => runDraw(p)}>
                    <Sparkles className="w-4 h-4 mr-1" /> {drawing === p.id ? "Sorteando..." : "Sortear"}
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => patch({ prizes: raffle.prizes.filter((x) => x.id !== p.id) })}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
              <Input placeholder="Descrição / patrocinador (opcional)" value={p.description || ""} onChange={(e) => {
                const prizes = [...raffle.prizes]; prizes[i] = { ...p, description: e.target.value }; patch({ prizes });
              }} />
              <Input placeholder="URL da foto do prêmio (opcional)" value={p.image_url || ""} onChange={(e) => {
                const prizes = [...raffle.prizes]; prizes[i] = { ...p, image_url: e.target.value }; patch({ prizes });
              }} />
              {won.length > 0 && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Trophy className="w-3 h-3" /> {won.map((w) => w.winner_name).join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Regras */}
      <div className="space-y-1">
        <Label className="text-xs uppercase text-muted-foreground">Regras do sorteio (texto exibido no formulário)</Label>
        <Textarea rows={6} value={raffle.rules_text || ""} onChange={(e) => patch({ rules_text: e.target.value })} />
      </div>

      {/* Formulário */}
      <div className="space-y-2">
        <Label className="text-xs uppercase text-muted-foreground">Formulário para participar</Label>
        <div className="flex flex-wrap gap-1">
          {SYSTEM_FIELDS.map((f) => {
            const on = raffle.form_fields.some((x) => x.key === f.key);
            return (
              <Button
                key={f.key}
                size="sm"
                variant={on ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() =>
                  patch({
                    form_fields: on
                      ? raffle.form_fields.filter((x) => x.key !== f.key)
                      : [...raffle.form_fields, { ...f }],
                  })
                }
              >
                {f.label}
              </Button>
            );
          })}
          <Button
            size="sm"
            variant="secondary"
            className="h-7 text-xs"
            onClick={() =>
              patch({
                form_fields: [
                  ...raffle.form_fields,
                  { key: `custom_${uid()}`, label: "Nova pergunta", type: "text", required: false },
                ],
              })
            }
          >
            <Plus className="w-3 h-3 mr-1" /> Pergunta
          </Button>
        </div>
        <div className="space-y-2">
          {raffle.form_fields.map((f, i) => (
            <div key={f.key} className="grid md:grid-cols-[1fr_140px_auto_auto] gap-2 items-center border rounded-md p-2">
              <Input value={f.label} onChange={(e) => { const ff = [...raffle.form_fields]; ff[i] = { ...f, label: e.target.value }; patch({ form_fields: ff }); }} />
              <Select value={f.type} onValueChange={(v) => { const ff = [...raffle.form_fields]; ff[i] = { ...f, type: v as RaffleField["type"] }; patch({ form_fields: ff }); }}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Texto</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="tel">Telefone</SelectItem>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="date">Data</SelectItem>
                  <SelectItem value="textarea">Texto longo</SelectItem>
                  <SelectItem value="select">Lista</SelectItem>
                  <SelectItem value="radio">Escolha única</SelectItem>
                  <SelectItem value="checkbox">Múltipla escolha</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex items-center gap-1 text-xs text-muted-foreground">
                <Switch checked={!!f.required} onCheckedChange={(v) => { const ff = [...raffle.form_fields]; ff[i] = { ...f, required: v }; patch({ form_fields: ff }); }} />
                obrigatório
              </label>
              <Button size="icon" variant="ghost" onClick={() => patch({ form_fields: raffle.form_fields.filter((x) => x.key !== f.key) })}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
              {["select", "radio", "checkbox"].includes(f.type) && (
                <Input
                  className="md:col-span-4"
                  placeholder="Opções separadas por ; (ex.: Sim; Não)"
                  value={(f.options || []).join("; ")}
                  onChange={(e) => { const ff = [...raffle.form_fields]; ff[i] = { ...f, options: e.target.value.split(";").map((s) => s.trim()).filter(Boolean) }; patch({ form_fields: ff }); }}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quem pode participar */}
      <div className="space-y-2 border rounded-md p-2">
        <Label className="text-xs uppercase text-muted-foreground">Quem pode participar</Label>
        {([
          ["require_consent", "Exigir aceite das regras"],
          ["require_contact", "Exigir WhatsApp ou e-mail válido"],
          ["require_stand_visit", "Exigir consultor do estande (visita registrada)"],
          ["require_purchase", "Exigir compra dentro do período da promoção"],
          ["one_entry_per_person", "Uma participação por pessoa (WhatsApp)"],
        ] as [keyof RaffleEligibility, string][]).map(([k, label]) => (
          <label key={String(k)} className="flex items-center justify-between text-sm">
            <span>{label}</span>
            <Switch checked={raffle.eligibility[k] !== false && !!raffle.eligibility[k]} onCheckedChange={(v) => patchRules({ [k]: v } as any)} />
          </label>
        ))}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-1">
          {([
            ["form", "Cadastro"],
            ["stand_visit", "Visita ao estande"],
            ["demo", "Demonstração"],
            ["purchase", "Compra"],
            ["referral", "Indicação"],
          ] as const).map(([k, label]) => (
            <div key={k}>
              <Label className="text-[11px]">{label}</Label>
              <Input
                type="number"
                min={0}
                value={raffle.eligibility.weights?.[k] ?? 0}
                onChange={(e) => patchRules({ weights: { ...raffle.eligibility.weights, [k]: Number(e.target.value) } })}
              />
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">Cada item vale este número de cupons no sorteio (peso). Deixe 1 para chance igual.</p>
      </div>

      {/* Sorteio e avisos */}
      <div className="space-y-3 border rounded-md p-2">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Forma de sorteio</Label>
            <Select value={raffle.draw_mode} onValueChange={(v) => patch({ draw_mode: v as Raffle["draw_mode"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="system">O sistema sorteia</SelectItem>
                <SelectItem value="manual">Manual (registro do ganhador)</SelectItem>
                <SelectItem value="public_audit">Sistema sorteia com resultado público</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between text-sm pt-6">
            <span>Mostrar ganhadores na página pública</span>
            <Switch checked={raffle.public_results} onCheckedChange={(v) => patch({ public_results: v })} />
          </label>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>Número (instância) que envia</Label>
            <Select value={raffle.wa_instance || ""} onValueChange={(v) => patch({ wa_instance: v })}>
              <SelectTrigger><SelectValue placeholder="Selecionar instância" /></SelectTrigger>
              <SelectContent>
                {[...new Set(groups.map((g) => g.instance_name).filter(Boolean))].map((inst) => (
                  <SelectItem key={inst as string} value={inst as string}>{inst}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Grupo de WhatsApp do resultado</Label>
            <Select
              value={raffle.wa_group_jid || ""}
              onValueChange={(v) => {
                const g = groups.find((x) => x.group_jid === v);
                patch({ wa_group_jid: v, wa_group_name: g?.name || null, wa_instance: raffle.wa_instance || g?.instance_name || null });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecionar grupo" /></SelectTrigger>
              <SelectContent>
                {groups
                  .filter((g) => !raffle.wa_instance || g.instance_name === raffle.wa_instance)
                  .map((g) => (
                    <SelectItem key={g.group_jid} value={g.group_jid}>{g.name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="flex items-center justify-between text-sm">
              <span>Avisar o ganhador no WhatsApp</span>
              <Switch checked={raffle.notify_winner} onCheckedChange={(v) => patch({ notify_winner: v })} />
            </label>
            <Textarea rows={4} value={raffle.winner_message_template || ""} onChange={(e) => patch({ winner_message_template: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="flex items-center justify-between text-sm">
              <span>Anunciar no grupo</span>
              <Switch checked={raffle.notify_group} onCheckedChange={(v) => patch({ notify_group: v })} />
            </label>
            <Textarea rows={4} value={raffle.group_message_template || ""} onChange={(e) => patch({ group_message_template: e.target.value })} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Variáveis: {"{ganhador}"} · {"{premio}"} · {"{sorteio}"} · {"{participantes}"}
        </p>
      </div>

      {draws.length > 0 && (
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Ganhadores</Label>
          {draws.map((d) => (
            <div key={d.id} className="text-xs flex items-center justify-between border rounded px-2 py-1">
              <span>{d.prize_title} — <strong>{d.winner_name}</strong></span>
              <span className="text-muted-foreground">
                {new Date(d.drawn_at).toLocaleString("pt-BR")} · {d.participants_count} part.
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar sorteio"}</Button>
      </div>
    </div>
  );
}
