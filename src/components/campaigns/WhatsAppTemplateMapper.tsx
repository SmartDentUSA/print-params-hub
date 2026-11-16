import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, FlaskConical, ImageIcon, Link2, Send, Upload } from "lucide-react";
import { META_NEW_NUMBER_DAILY_LIMIT, fmtSaoPaulo, planBroadcast, saoPauloLocalToIso } from "@/lib/waBroadcastSchedule";

export type WaAccount = { accountId: string; profileId: string; name: string | null; phone: string | null };
type HeaderType = "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT" | "LOCATION";
type TplButton = { type: string; text: string; url?: string; urlHasVariable?: boolean };
type Template = { name: string; language: string; category: string; body: string; vars: number; headerType?: HeaderType; buttons?: TplButton[]; footer?: string };
/** Rótulos das variáveis do template universal (smartdent_campanha_universal_*). */
const UNIVERSAL_VAR_LABELS = ["Nome do lead", "Título/Produto", "Mensagem principal", "Condição/Oferta"];
const isUniversal = (t?: Template) => !!t && /^smartdent_campanha_universal/i.test(t.name);
const urlPrefix = (u?: string) => String(u ?? "").split(/\{\{\d+\}\}/)[0];
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
  const [buttonLinks, setButtonLinks] = useState<Record<string, string>>({});
  const [testing, setTesting] = useState(false);
  // ID da campanha gerado antes do envio: a imagem fica em whatsapp/{id}/ e a campanha nasce com esse id.
  const [draftCampaignId] = useState(() => crypto.randomUUID());

  const tpl = templates.find((t) => `${t.name}|${t.language}` === tplKey);
  const headerType: HeaderType = tpl?.headerType ?? "NONE";
  const needsMedia = MEDIA_HEADERS.includes(headerType);
  const perHour = perHourText.trim() ? Number(perHourText) : null;
  const perHourValid = perHour == null || (Number.isInteger(perHour) && perHour >= 1 && perHour <= 10000);
  const scheduledAtIso = scheduleLocal ? saoPauloLocalToIso(scheduleLocal) : null;
  const scheduleValid = !scheduleLocal || (!!scheduledAtIso && new Date(scheduledAtIso).getTime() > Date.now() + 60_000);
  const plan = planBroadcast({ leads: audienceCount, perHour: perHourValid ? perHour : null, scheduledAtIso, now: new Date() });
  const mediaValid = !needsMedia || /^https:\/\//i.test(headerMediaUrl.trim());
  const buttonErrors = (tpl?.buttons ?? []).map((b, i) => {
    const link = (buttonLinks[String(i)] ?? "").trim();
    if (b.type === "URL" && b.urlHasVariable) {
      if (!link) return "Informe o link do botão.";
      if (!/^https:\/\//i.test(link)) return "O link precisa começar com https://";
      const pre = urlPrefix(b.url);
      if (!link.startsWith(pre) || link.length <= pre.length) return `O link precisa começar com ${pre}`;
      return null;
    }
    if (b.type !== "URL" && link && !/^https:\/\/\S+\.\S+/i.test(link)) return "Use um link completo começando com https://";
    return null;
  });
  const buttonsValid = buttonErrors.every((e) => !e);

  const uploadHeaderImage = async (file: File) => {
    if (!["image/jpeg", "image/png"].includes(file.type)) { toast.error("Use uma imagem JPG ou PNG (formatos aceitos pela Meta)."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("A imagem precisa ter no máximo 5 MB."); return; }
    setUploading(true);
    const ext = file.type === "image/png" ? "png" : "jpg";
    const path = `whatsapp/${draftCampaignId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("wa-media").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setUploading(false); toast.error(`Erro no envio da imagem: ${error.message}`); return; }
    setHeaderMediaUrl(supabase.storage.from("wa-media").getPublicUrl(path).data.publicUrl);
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
    setButtonLinks({});
    setVars(Array.from({ length: tpl?.vars ?? 0 }, (_, i) =>
      i === 0 ? { source: "field", value: "primeiro_nome", fallback: "colega" } : { source: "literal", value: "", fallback: "" }));
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

  const contentReady = !!account && !!tpl && !!campaignName.trim() && headerType !== "LOCATION" &&
    mediaValid && buttonsValid && vars.every((v) => (v.source === "literal" ? v.value.trim() : v.fallback.trim()));
  const canSend = contentReady && audienceCount > 0 && perHourValid && scheduleValid;
  const perActive = !!perHour && perHourValid;
  const endAt = new Date(plan.lastAt.getTime() + (perActive ? 3_600_000 : 0));
  const summary = perActive
    ? `${audienceCount} leads, ${perHour} por hora = ${plan.slots} ${plan.slots === 1 ? "bloco" : "blocos"} (${plan.durationHours} ${plan.durationHours === 1 ? "hora" : "horas"}), começa ${fmtSaoPaulo(plan.startAt)} e termina por volta de ${fmtSaoPaulo(endAt)}`
    : `${audienceCount} leads, tudo de uma vez, ${plan.scheduled ? `em ${fmtSaoPaulo(plan.startAt)}` : "agora"}`;

  const update = (i: number, patch: Partial<VarSpec>) => setVars(vars.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const cleanButtonLinks = () => Object.fromEntries(Object.entries(buttonLinks).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));

  const sendTest = async () => {
    if (!contentReady) return;
    if (!confirm(`Enviar o modelo "${tpl!.name}" só para o lead de teste (Danilo Henrique)?`)) return;
    setTesting(true);
    const t = toast.loading("Enviando teste...");
    try {
      const r = await callWaBroadcast({
        action: "test", accountId: account!.accountId, profileId: account!.profileId,
        templateName: tpl!.name, language: tpl!.language, name: campaignName.trim(),
        variableMap: vars, buttonLinks: cleanButtonLinks(),
        ...(needsMedia ? { headerMediaUrl: headerMediaUrl.trim() } : {}),
      });
      toast.success(`Teste enviado para ${r.lead ?? "o lead de teste"}. Confira a imagem e o texto no celular.`, { id: t });
      (r.warnings ?? []).forEach((w: string) => toast.warning(w));
    } catch (e: any) {
      toast.error(e.message, { id: t });
    } finally { setTesting(false); }
  };

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
        leadIds, variableMap: vars, campaignId: draftCampaignId, buttonLinks: cleanButtonLinks(),
        ...(needsMedia ? { headerMediaUrl: headerMediaUrl.trim() } : {}),
        ...(perHour && perHourValid ? { perHour } : {}),
        ...(scheduledAtIso ? { scheduledAt: scheduledAtIso } : {}),
      });
      const ignored = r.skipped ? ` (${r.skipped} ignorados)` : "";
      toast.success(r.scheduled
        ? `Campanha agendada: ${r.added} destinatários${ignored} em ${r.slots} lote(s), a partir de ${fmtSaoPaulo(new Date(r.scheduled_at))}`
        : `Disparo iniciado: ${r.added} destinatários${ignored}`, { id: t });
      (r.warnings ?? []).forEach((w: string) => toast.warning(w));
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

        {tpl && headerType === "LOCATION" && (
          <p className="text-xs text-destructive">Templates com cabeçalho de localização não são suportados neste envio.</p>
        )}

        {tpl && vars.length > 0 && (
          <div className="space-y-2">
            <Label>1. Variáveis do texto</Label>
            {vars.map((v, i) => {
              const label = isUniversal(tpl) ? UNIVERSAL_VAR_LABELS[i] : undefined;
              return (
                <div key={i} className="space-y-1">
                  {label && <p className="text-xs font-medium text-muted-foreground">{`{{${i + 1}}}`} · {label}</p>}
                  <div className="grid grid-cols-[3rem_1fr_1fr] gap-2 items-center">
                    <Badge variant="outline" className="justify-center">{`{{${i + 1}}}`}</Badge>
                    <Select
                      value={v.source === "literal" ? "__literal__" : v.value}
                      onValueChange={(x) => update(i, x === "__literal__" ? { source: "literal", value: "" } : { source: "field", value: x, fallback: v.fallback || (x === "primeiro_nome" ? "colega" : "") })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SYSTEM_FIELDS.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
                        <SelectItem value="__literal__">Texto fixo</SelectItem>
                      </SelectContent>
                    </Select>
                    {v.source === "literal" ? (
                      <div>
                        <Input value={v.value} maxLength={1000} onChange={(e) => update(i, { value: e.target.value })} placeholder={label ? `${label} (igual para todos)` : "Texto igual para todos"} />
                        <p className="mt-0.5 text-right text-[11px] text-muted-foreground">{v.value.length} caracteres</p>
                      </div>
                    ) : (
                      <Input value={v.fallback} onChange={(e) => update(i, { fallback: e.target.value })} placeholder="Se o campo estiver vazio, usar..." />
                    )}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">Campos do sistema exigem um valor padrão para leads sem a informação.</p>
          </div>
        )}

        {tpl && needsMedia && (
          <div className="space-y-2">
            <Label>2. {headerType === "IMAGE" ? "Imagem da campanha (obrigatória)" : `${HEADER_LABEL[headerType]} da campanha (obrigatório)`}</Label>
            <p className="text-xs text-muted-foreground">A imagem aprovada na Meta é só uma amostra e nunca é enviada. Use JPG ou PNG de até 5 MB, de preferência na proporção 1,91:1 ou quadrada.</p>
            {headerType === "IMAGE" && (
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={uploading} asChild>
                  <label className="cursor-pointer">
                    <Upload className="w-4 h-4 mr-1" /> {uploading ? "Enviando..." : headerMediaUrl.trim() ? "Trocar imagem" : "Enviar imagem (JPG ou PNG, até 5 MB)"}
                    <input type="file" accept="image/jpeg,image/png" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadHeaderImage(f); }} />
                  </label>
                </Button>
                {headerMediaUrl.trim() && <Button type="button" variant="ghost" size="sm" onClick={() => setHeaderMediaUrl("")}>Remover</Button>}
              </div>
            )}
            <Input value={headerMediaUrl} onChange={(e) => setHeaderMediaUrl(e.target.value)} placeholder="ou cole um link https:// público da imagem" />
            {headerMediaUrl.trim() && !mediaValid && <p className="text-xs text-destructive">O link precisa começar com https://</p>}
            {headerType === "IMAGE" && mediaValid && headerMediaUrl.trim() && (
              <img src={headerMediaUrl.trim()} alt="Imagem da campanha" className="max-h-40 rounded-md border object-contain" />
            )}
            {headerType === "IMAGE" && !headerMediaUrl.trim() && (
              <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
                <ImageIcon className="w-4 h-4 mr-1" /> Nenhuma imagem escolhida — o envio fica bloqueado
              </div>
            )}
          </div>
        )}

        {tpl && !!tpl.buttons?.length && (
          <div className="space-y-2">
            <Label>{needsMedia ? "3" : "2"}. Botões</Label>
            {tpl.buttons.map((b, i) => {
              const k = String(i);
              const err = buttonErrors[i];
              return (
                <div key={i} className="space-y-1 rounded-md border p-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary">{b.text}</Badge>
                    <span className="text-xs text-muted-foreground">{b.type === "URL" ? "botão de link" : b.type === "QUICK_REPLY" ? "resposta rápida" : b.type === "PHONE_NUMBER" ? "ligação" : b.type.toLowerCase()}</span>
                  </div>
                  {b.type === "URL" && b.urlHasVariable && (
                    <Input value={buttonLinks[k] ?? ""} onChange={(e) => setButtonLinks({ ...buttonLinks, [k]: e.target.value })} placeholder={`Link do botão (começando com ${urlPrefix(b.url)})`} />
                  )}
                  {b.type === "URL" && !b.urlHasVariable && (
                    <p className="text-xs text-muted-foreground">Link fixo aprovado na Meta: {b.url}. Ele não pode ser trocado neste envio.</p>
                  )}
                  {b.type === "QUICK_REPLY" && (
                    <>
                      <Input value={buttonLinks[k] ?? ""} onChange={(e) => setButtonLinks({ ...buttonLinks, [k]: e.target.value })} placeholder="Link enviado quando o lead clicar (opcional)" />
                      <p className="text-[11px] text-muted-foreground">Resposta rápida não abre link direto. O link só será enviado na resposta automática (em breve).</p>
                    </>
                  )}
                  {err && <p className="text-xs text-destructive">{err}</p>}
                </div>
              );
            })}
          </div>
        )}

        {tpl && (
          <div className="space-y-1">
            <Label>Pré-visualização {sample?.nome ? `(${sample.nome})` : ""}</Label>
            <div className="rounded-lg bg-muted p-3">
              <div className="max-w-sm overflow-hidden rounded-lg bg-card shadow-sm">
                {needsMedia && (headerMediaUrl.trim() && mediaValid
                  ? <img src={headerMediaUrl.trim()} alt="" className="aspect-[1.91/1] w-full object-cover" />
                  : <div className="flex aspect-[1.91/1] w-full items-center justify-center bg-muted text-xs text-muted-foreground"><ImageIcon className="w-4 h-4 mr-1" /> Imagem da campanha</div>)}
                <div className="px-3 pt-2 pb-1 text-sm whitespace-pre-wrap">{preview || "(template sem texto)"}</div>
                {tpl.footer && <p className="px-3 pb-2 text-[11px] text-muted-foreground">{tpl.footer}</p>}
                {tpl.buttons?.map((b, i) => (
                  <div key={i} className="flex items-center justify-center gap-1 border-t py-2 text-sm font-medium text-primary">
                    {b.type === "URL" && <Link2 className="w-3.5 h-3.5" />} {b.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tpl && (
          <div className="space-y-3 rounded-md border p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label className="text-xs">Envios por hora</Label>
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
              {tpl && <span className="block text-xs text-muted-foreground mt-1">Modelo {tpl.name}{needsMedia ? ` · ${headerMediaUrl.trim() ? "imagem escolhida" : "sem imagem"}` : ""}</span>}
            </div>
            {plan.movedByWindow && (
              <p className="text-xs text-muted-foreground">Envios só saem entre 07:30 e 19:00 (Brasília); blocos fora desse horário passam para o início do dia seguinte.</p>
            )}
            {audienceCount > META_NEW_NUMBER_DAILY_LIMIT && (
              <p className="text-xs text-destructive">
                Atenção: o número +55 16 3419-4735 começa com limite de {META_NEW_NUMBER_DAILY_LIMIT} contatos por dia na Meta; acima disso os envios param sem aviso.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
          <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" onClick={sendTest} disabled={!contentReady || testing || sending}
            title="Envia este modelo só para o lead de teste Danilo Henrique">
            <FlaskConical className="w-4 h-4 mr-1" /> {testing ? "Enviando teste..." : "Enviar teste"}
          </Button>
          <Button onClick={send} disabled={!canSend || sending || testing}>
            {plan.scheduled ? <CalendarClock className="w-4 h-4 mr-1" /> : <Send className="w-4 h-4 mr-1" />}
            {sending ? (plan.scheduled ? "Agendando..." : "Enviando...") : plan.scheduled ? "Agendar campanha" : `Disparar para ${audienceCount} leads`}
          </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
