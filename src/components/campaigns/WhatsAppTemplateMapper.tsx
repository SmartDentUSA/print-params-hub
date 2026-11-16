import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, ImageIcon, Send, Upload } from "lucide-react";
import { META_NEW_NUMBER_DAILY_LIMIT, fmtSaoPaulo, planBroadcast, saoPauloLocalToIso } from "@/lib/waBroadcastSchedule";

export type WaAccount = { accountId: string; profileId: string; name: string | null; phone: string | null };
type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
type Template = { name: string; language: string; category: string; body: string; vars: number; headerType?: HeaderType; buttons?: { type: string; text: string }[] };
const MEDIA_HEADERS: HeaderType[] = ["IMAGE", "VIDEO", "DOCUMENT"];
const HEADER_LABEL: Record<HeaderType, string> = { NONE: "Sem cabeçalho", TEXT: "Texto", IMAGE: "Imagem", VIDEO: "Vídeo", DOCUMENT: "Documento", LOCATION: "Localização" };
type VarSpec = { source: "field" | "literal"; value: string; fallback: string };

export const SYSTEM_FIELDS: { key: string; label: string }[] = [
  { key: "primeiro_nome", label: "Primeiro nome" },
  { key: "nome", label: "Nome completo" },
  { key: "empresa", label: "Empresa" },
  { key: "cidade", label: "Cidade" },
  { key: "uf", label: "UF" },
  { key: "especialidade", label: "Especialidade" },
  { key: "produto_interesse", label: "Produto de interesse" },
  { key: "vendedor", label: "Vendedor responsável" },
  { key: "ultimo_formulario", label: "Último formulário" },
  { key: "cupom", label: "Cupom" },
  { key: "email", label: "E-mail" },
];

export async function callWaBroadcast(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("zernio-wa-broadcast", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* */ }
    throw new Error(msg);
  }
  return data as any;
}

interface Props {
  account: WaAccount | undefined;
  campaignName: string;
  description: string;
  audienceCount: number;
  resolveLeadIds: () => Promise<string[]>;
  onBack: () => void;
  onSent: () => void;
}

export default function WhatsAppTemplateMapper({ account, campaignName, description, audienceCount, resolveLeadIds, onBack, onSent }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(false);
  const [tplKey, setTplKey] = useState("");
  const [vars, setVars] = useState<VarSpec[]>([]);
  const [sample, setSample] = useState<Record<string, string> | null>(null);
  const [sending, setSending] = useState(false);
  const [headerMediaUrl, setHeaderMediaUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [perHourText, setPerHourText] = useState("");
  const [scheduleLocal, setScheduleLocal] = useState("");

  const tpl = templates.find((t) => `${t.name}|${t.language}` === tplKey);
  const headerType: HeaderType = tpl?.headerType ?? "NONE";
  const needsMedia = MEDIA_HEADERS.includes(headerType);
  const perHour = perHourText.trim() ? Number(perHourText) : null;
  const perHourValid = perHour == null || (Number.isInteger(perHour) && perHour >= 1 && perHour <= 10000);
  const scheduledAtIso = scheduleLocal ? saoPauloLocalToIso(scheduleLocal) : null;
  const scheduleValid = !scheduleLocal || (!!scheduledAtIso && new Date(scheduledAtIso).getTime() > Date.now() + 60_000);
  const plan = planBroadcast({ leads: audienceCount, perHour: perHourValid ? perHour : null, scheduledAtIso, now: new Date() });
  const mediaValid = !needsMedia || /^https:\/\//i.test(headerMediaUrl.trim());

  const uploadHeaderImage = async (file: File) => {
    if (!["image/jpeg", "image/png"].includes(file.type)) { toast.error("Use uma imagem JPG ou PNG (formatos aceitos pela Meta)."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A imagem precisa ter no máximo 5 MB."); return; }
    setUploading(true);
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `wa-campaign-header/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("catalog-images").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setUploading(false); toast.error(`Erro no envio da imagem: ${error.message}`); return; }
    setHeaderMediaUrl(supabase.storage.from("catalog-images").getPublicUrl(path).data.publicUrl);
    setUploading(false);
  };

  useEffect(() => {
    if (!account) return;
    setLoadingTpl(true);
    callWaBroadcast({ action: "templates", accountId: account.accountId })
      .then((d) => setTemplates(d.templates ?? []))
      .catch((e) => toast.error(`Modelos: ${e.message}`))
      .finally(() => setLoadingTpl(false));
  }, [account?.accountId]);

  useEffect(() => {
    setHeaderMediaUrl("");
    setVars(Array.from({ length: tpl?.vars ?? 0 }, (_, i) =>
      i === 0 ? { source: "field", value: "primeiro_nome", fallback: "Doutor(a)" } : { source: "literal", value: "", fallback: "" }));
  }, [tplKey]);

  // Lead real do segmento para prévia
  useEffect(() => {
    let alive = true;
    resolveLeadIds().then(async (ids) => {
      if (!ids.length || !alive) return;
      const d = await callWaBroadcast({ action: "sample", leadId: ids[0] });
      if (alive) setSample(d.lead ?? null);
    }).catch(() => { /* prévia é opcional */ });
    return () => { alive = false; };
  }, []);

  const valueFor = (v: VarSpec) => {
    const raw = v.source === "literal" ? v.value : sample?.[v.value] ?? "";
    return raw || v.fallback || "";
  };

  const preview = useMemo(() => {
    if (!tpl) return "";
    return tpl.body.replace(/\{\{(\d+)\}\}/g, (_, n) => {
      const v = vars[Number(n) - 1];
      if (!v) return `{{${n}}}`;
      const label = v.source === "field" ? `[${SYSTEM_FIELDS.find((f) => f.key === v.value)?.label}]` : `{{${n}}}`;
      return valueFor(v) || label;
    });
  }, [tpl, vars, sample]);

  const canSend = !!account && !!tpl && campaignName.trim() && audienceCount > 0 && headerType !== "LOCATION" &&
    mediaValid && perHourValid && scheduleValid &&
    vars.every((v) => (v.source === "literal" ? v.value.trim() : v.fallback.trim()));
  const summary = `${audienceCount} leads · ${perHour && perHourValid ? `${perHour} por hora · duração ≈ ${plan.durationHours} h` : "sem limite por hora"} · início ${plan.scheduled ? fmtSaoPaulo(plan.startAt) : "agora"}${perHour && perHourValid ? ` · término previsto ${fmtSaoPaulo(plan.lastAt)}` : ""}`;

  const update = (i: number, patch: Partial<VarSpec>) => setVars(vars.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  const send = async () => {
    if (!canSend) return;
    if (!confirm(plan.scheduled
      ? `Agendar o modelo "${tpl!.name}" para até ${audienceCount} leads?\n\n${summary}`
      : `Enviar o modelo "${tpl!.name}" para até ${audienceCount} leads?`)) return;
    setSending(true);
    const t = toast.loading(plan.scheduled ? "Preparando público e agendando..." : "Preparando público e enviando...");
    try {
      const leadIds = await resolveLeadIds();
      const r = await callWaBroadcast({
        action: "send", accountId: account!.accountId, profileId: account!.profileId,
        templateName: tpl!.name, language: tpl!.language, name: campaignName.trim(), description,
        leadIds, variableMap: vars,
        ...(needsMedia ? { headerMediaUrl: headerMediaUrl.trim() } : {}),
        ...(perHour && perHourValid ? { perHour } : {}),
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      });
      const ignored = r.skipped ? ` (${r.skipped} ignorados)` : "";
      toast.success(r.scheduled
        ? `Campanha agendada: ${r.added} destinatários${ignored} em ${r.slots} lote(s), a partir de ${fmtSaoPaulo(new Date(r.scheduled_at))}`
        : `Disparo iniciado: ${r.added} destinatários${ignored}`, { id: t });
      onSent();
    } catch (e: any) {
      toast.error(e.message, { id: t });
    } finally { setSending(false); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">3. Template aprovado e variáveis</CardTitle>
        <CardDescription>
          Número: <b>{account ? `${account.name ?? ""}${account.phone ? ` — ${account.phone}` : ""}` : "não selecionado"}</b> • Público: <b>{audienceCount}</b> leads.
          Números novos na Meta começam com limite de 250 contatos por dia.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Template aprovado</Label>
          <Select value={tplKey} onValueChange={setTplKey} disabled={!account || loadingTpl}>
            <SelectTrigger>
              <SelectValue placeholder={loadingTpl ? "Carregando..." : templates.length ? "Selecione o template" : "Nenhum template aprovado"} />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>
                  {t.name} · {t.language} · {t.category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tpl && (
          <div className="grid gap-3 rounded-md border p-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Cabeçalho do template</Label>
              <p className="text-sm font-medium">{HEADER_LABEL[headerType]}</p>
              {headerType === "LOCATION" && <p className="text-xs text-destructive">Templates com cabeçalho de localização não são suportados neste envio.</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Botões do template (somente leitura)</Label>
              {tpl.buttons?.length ? (
                <div className="flex flex-wrap gap-1">
                  {tpl.buttons.map((b, i) => <Badge key={i} variant="secondary">{b.text}</Badge>)}
                </div>
              ) : <p className="text-sm text-muted-foreground">Sem botões</p>}
            </div>
          </div>
        )}

        {tpl && needsMedia && (
          <div className="space-y-2">
            <Label>{headerType === "IMAGE" ? "Imagem da campanha (obrigatória)" : `${HEADER_LABEL[headerType]} da campanha (obrigatório)`}</Label>
            <p className="text-xs text-muted-foreground">A imagem aprovada na Meta é só uma amostra e nunca é enviada: escolha a mídia desta campanha.</p>
            {headerType === "IMAGE" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <label className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-1" /> {uploading ? "Enviando..." : "Enviar imagem (JPG ou PNG, até 5 MB)"}
                    <input type="file" accept="image/jpeg,image/png" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadHeaderImage(f); }} />
                  </label>
                </Button>
              </div>
            )}
            <Input value={headerMediaUrl} onChange={(e) => setHeaderMediaUrl(e.target.value)} placeholder="https://... (link público da mídia)" />
            {headerMediaUrl.trim() && !mediaValid && <p className="text-xs text-destructive">O link precisa começar com https://</p>}
            {headerType === "IMAGE" && mediaValid && headerMediaUrl.trim() && (
              <img src={headerMediaUrl.trim()} alt="Imagem do cabeçalho da campanha" className="max-h-48 rounded-md border object-contain" />
            )}
            {headerType === "IMAGE" && !headerMediaUrl.trim() && (
              <div className="flex h-24 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                <ImageIcon className="w-4 h-4 mr-1" /> Nenhuma imagem escolhida
              </div>
            )}
          </div>
        )}

        {tpl && vars.length > 0 && (
          <div className="space-y-2">
            <Label>Mapear variáveis do template para campos do sistema</Label>
            {vars.map((v, i) => (
              <div key={i} className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center">
                <Badge variant="outline" className="justify-center">{`{{${i + 1}}}`}</Badge>
                <Select
                  value={v.source === "literal" ? "__literal__" : v.value}
                  onValueChange={(x) => update(i, x === "__literal__" ? { source: "literal", value: "" } : { source: "field", value: x })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SYSTEM_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                    <SelectItem value="__literal__">Texto fixo</SelectItem>
                  </SelectContent>
                </Select>
                {v.source === "literal" ? (
                  <Input value={v.value} onChange={(e) => update(i, { value: e.target.value })} placeholder="Texto igual para todos" />
                ) : (
                  <Input value={v.fallback} onChange={(e) => update(i, { fallback: e.target.value })} placeholder="Se o campo estiver vazio, usar..." />
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">Campos do sistema exigem um valor padrão para leads sem a informação.</p>
          </div>
        )}

        {tpl && (
          <div className="space-y-1">
            <Label>Prévia {sample?.nome ? `(${sample.nome})` : ""}</Label>
            <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{preview || "(template sem texto)"}</div>
          </div>
        )}

        {tpl && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Enviar por hora</Label>
                <Input type="number" min={1} max={10000} value={perHourText} onChange={(e) => setPerHourText(e.target.value)} placeholder="Vazio = sem limite" />
                {!perHourValid && <p className="text-xs text-destructive mt-1">Use um número inteiro entre 1 e 10.000.</p>}
              </div>
              <div>
                <Label className="text-xs">Agendar para (horário de Brasília)</Label>
                <Input type="datetime-local" value={scheduleLocal} onChange={(e) => setScheduleLocal(e.target.value)} />
                {!scheduleValid && <p className="text-xs text-destructive mt-1">Escolha um horário pelo menos 1 minuto no futuro.</p>}
                {!scheduleLocal && <p className="text-[11px] text-muted-foreground mt-1">Vazio = agora{perHour ? " (primeiro lote em 2 minutos)" : ""}.</p>}
              </div>
            </div>
            <div className="rounded-md bg-muted/40 p-2 text-sm">
              <CalendarClock className="mr-1 inline w-4 h-4" /> {summary}
            </div>
            {(audienceCount > META_NEW_NUMBER_DAILY_LIMIT || (perHour ?? 0) * 24 > META_NEW_NUMBER_DAILY_LIMIT) && (
              <p className="text-xs text-destructive">
                Atenção: número novo na Meta entrega só {META_NEW_NUMBER_DAILY_LIMIT} contatos por dia; acima disso os envios param sem aviso.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
          <Button onClick={send} disabled={!canSend || sending}>
            {plan.scheduled ? <CalendarClock className="w-4 h-4 mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            {sending ? (plan.scheduled ? "Agendando..." : "Enviando...") : plan.scheduled ? "Agendar campanha" : `Disparar para ${audienceCount} leads`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
