import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, CalendarClock, Coins, FlaskConical, ImageIcon, Link2, Plus, Send, Upload } from "lucide-react";
import { META_NEW_NUMBER_DAILY_LIMIT, estimateCost, fillTokens, fmtSaoPaulo, planBroadcast, saoPauloLocalToIso } from "@/lib/waBroadcastSchedule";
import { CampaignLinkPicker } from "@/components/smartops/CampaignLinkPicker";
import { BUTTON_LINK_SECTIONS } from "@/lib/social/groupLinkSections";

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
/** Igual ao limite do servidor (zernio-wa-broadcast/plan.ts). */
const MAX_TEST_PHONES = 5;
/** Estimativa inicial do custo de uma mensagem de marketing no Brasil (editável na tela). */
const DEFAULT_COST_PER_MESSAGE = "0.35";
const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  const [testPhonesText, setTestPhonesText] = useState("");
  const [perDayText, setPerDayText] = useState(String(META_NEW_NUMBER_DAILY_LIMIT));
  const [costText, setCostText] = useState(DEFAULT_COST_PER_MESSAGE);
  const literalRefs = useRef<(HTMLInputElement | null)[]>([]);
  // ID da campanha gerado antes do envio: a imagem fica em whatsapp/{id}/ e a campanha nasce com esse id.
  const [draftCampaignId] = useState(() => crypto.randomUUID());

  const tpl = templates.find((t) => `${t.name}|${t.language}` === tplKey);
  const headerType: HeaderType = tpl?.headerType ?? "NONE";
  const needsMedia = MEDIA_HEADERS.includes(headerType);
  const perHour = perHourText.trim() ? Number(perHourText) : null;
  const perHourValid = perHour == null || (Number.isInteger(perHour) && perHour >= 1 && perHour <= 10000);
  const scheduledAtIso = scheduleLocal ? saoPauloLocalToIso(scheduleLocal) : null;
  const scheduleValid = !scheduleLocal || (!!scheduledAtIso && new Date(scheduledAtIso).getTime() > Date.now() + 60_000);
  const perDay = perDayText.trim() ? Number(perDayText) : null;
  const perDayValid = perDay == null || (Number.isInteger(perDay) && perDay >= 1 && perDay <= 100000);
  const costPerMessage = costText.trim() ? Number(costText.replace(",", ".")) : null;
  const costValid = costPerMessage == null || (Number.isFinite(costPerMessage) && costPerMessage >= 0 && costPerMessage <= 100);
  const plan = planBroadcast({ leads: audienceCount, perHour: perHourValid ? perHour : null, perDay: perDayValid ? perDay : null, scheduledAtIso, now: new Date() });
  const tooFar = plan.lastAt.getTime() > Date.now() + 60 * 86_400_000;
  const totalCost = costValid && costPerMessage != null ? estimateCost(audienceCount, costPerMessage) : null;
  const batchesByDay = useMemo(() => {
    const m = new Map<string, { day: string; count: number; times: string[] }>();
    for (const b of plan.batches) {
      const [day, time] = fmtSaoPaulo(b.at).split(" ");
      const g = m.get(day) ?? { day, count: 0, times: [] };
      g.count += b.count; g.times.push(time); m.set(day, g);
    }
    return [...m.values()];
  }, [plan]);
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

  // Campo do sistema dentro do texto livre: valor do lead da prévia; sem lead de prévia, mostra [Rótulo].
  const tokenValue = (k: string) => {
    const f = SYSTEM_FIELDS.find((x) => x.key === k);
    if (!f) return null;
    return sample ? sample[k] ?? "" : `[${f.label}]`;
  };
  const valueFor = (v: VarSpec) => {
    const raw = v.source === "literal" ? fillTokens(v.value, tokenValue) : sample?.[v.value] ?? "";
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
  const canSend = contentReady && audienceCount > 0 && perHourValid && scheduleValid && perDayValid && costValid && !tooFar;
  const perActive = !!perHour && perHourValid;
  const endAtHour = new Date(plan.lastAt.getTime() + 3_600_000);
  const endAt = perActive ? endAtHour : plan.lastAt;
  const limits = [perActive ? `${perHour} por hora` : null, plan.days > 1 ? `máximo ${perDay} por dia` : null].filter(Boolean).join(" e ");
  const summary = plan.slots > 1
    ? `${audienceCount} leads, ${limits} = ${plan.slots} ${plan.slots === 1 ? "lote" : "lotes"}${plan.days > 1 ? ` em ${plan.days} dias` : ""}, começa ${fmtSaoPaulo(plan.startAt)} e termina por volta de ${fmtSaoPaulo(endAt)}`
    : `${audienceCount} leads, tudo de uma vez, ${plan.scheduled ? `em ${fmtSaoPaulo(plan.startAt)}` : "agora"}`;

  const update = (i: number, patch: Partial<VarSpec>) => setVars(vars.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const insertToken = (i: number, key: string) => {
    const el = literalRefs.current[i];
    const cur = vars[i]?.value ?? "";
    const at = el?.selectionStart ?? cur.length;
    const end = el?.selectionEnd ?? at;
    const before = cur.slice(0, at), after = cur.slice(end);
    const token = `${before && !/\s$/.test(before) ? " " : ""}{${key}}${after && !/^[\s,.!?;:]/.test(after) ? " " : ""}`;
    update(i, { value: (before + token + after).slice(0, 1000) });
    requestAnimationFrame(() => { el?.focus(); const pos = before.length + token.length; el?.setSelectionRange(pos, pos); });
  };
  const setLink = (k: string, v: string) => setButtonLinks((prev) => ({ ...prev, [k]: v }));
  const cleanButtonLinks = () => Object.fromEntries(Object.entries(buttonLinks).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));

  const testPhones = testPhonesText.split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
  const testPhoneErrors = testPhones.filter((x) => { const d = x.replace(/\D/g, ""); return !(d.length >= 10 && d.length <= 13); });
  const testPhonesValid = testPhones.length <= MAX_TEST_PHONES && testPhoneErrors.length === 0;

  const sendTest = async () => {
    if (!contentReady || !testPhonesValid) return;
    const who = testPhones.length ? testPhones.join(", ") : "o lead de teste (Danilo Henrique)";
    if (!confirm(`Enviar o modelo "${tpl!.name}" só para ${who}?\n\nIsso não dispara a campanha.`)) return;
    setTesting(true);
    const t = toast.loading("Enviando teste...");
    try {
      const r = await callWaBroadcast({
        action: "test", accountId: account!.accountId, profileId: account!.profileId,
        templateName: tpl!.name, language: tpl!.language, name: campaignName.trim(),
        variableMap: vars, buttonLinks: cleanButtonLinks(),
        ...(testPhones.length ? { testPhones } : {}),
        ...(needsMedia ? { headerMediaUrl: headerMediaUrl.trim() } : {}),
      });
      const dest = r.phones?.length && testPhones.length ? r.phones.join(", ") : r.lead ?? "o lead de teste";
      toast.success(`Teste enviado para ${dest}. Confira a imagem e o texto no celular.`, { id: t });
      (r.warnings ?? []).forEach((w: string) => toast.warning(w));
    } catch (e: any) {
      toast.error(e.message, { id: t });
    } finally { setTesting(false); }
  };

  const send = async () => {
    if (!canSend) return;
    if (!confirm(plan.scheduled
      ? `Agendar o modelo "${tpl!.name}" para até ${audienceCount} leads?\n\n${summary}${totalCost != null ? `\nCusto estimado: ${brl(totalCost)}` : ""}`
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
        ...(perDay && perDayValid ? { perDay } : {}),
        ...(costPerMessage != null && costValid ? { costPerMessage } : {}),
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
                        <SelectItem value="__literal__">Texto livre (frases + campos)</SelectItem>
                      </SelectContent>
                    </Select>
                    {v.source === "literal" ? (
                      <div>
                        <Input ref={(el) => { literalRefs.current[i] = el; }} value={v.value} maxLength={1000}
                          onChange={(e) => update(i, { value: e.target.value })}
                          placeholder={label ? `${label}: escreva a frase e insira campos do sistema` : "Escreva a frase e insira campos do sistema"} />
                        <div className="mt-1 flex flex-wrap items-center gap-1">
                          <span className="text-[11px] text-muted-foreground">Inserir campo:</span>
                          {SYSTEM_FIELDS.map((f) => (
                            <button key={f.key} type="button" onClick={() => insertToken(i, f.key)}
                              className="inline-flex items-center gap-0.5 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted">
                              <Plus className="w-3 h-3" />{f.label}
                            </button>
                          ))}
                          <span className="ml-auto text-[11px] text-muted-foreground">{v.value.length} caracteres</span>
                        </div>
                      </div>
                    ) : (
                      <Input value={v.fallback} onChange={(e) => update(i, { fallback: e.target.value })} placeholder="Se o campo estiver vazio, usar..." />
                    )}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Campo do sistema sozinho exige um valor padrão para leads sem a informação. No texto livre, campo vazio some da frase (o primeiro nome vira "colega").
            </p>
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
                    <div className="flex gap-2">
                      <Input value={buttonLinks[k] ?? ""} onChange={(e) => setLink(k, e.target.value)} placeholder={`Link do botão (começando com ${urlPrefix(b.url)})`} />
                      <CampaignLinkPicker channel="whatsapp" sections={BUTTON_LINK_SECTIONS} onInsert={(t) => setLink(k, t.trim())} />
                    </div>
                  )}
                  {b.type === "URL" && !b.urlHasVariable && (
                    <p className="text-xs text-muted-foreground">Link fixo aprovado na Meta: {b.url}. Ele não pode ser trocado neste envio.</p>
                  )}
                  {b.type === "QUICK_REPLY" && (
                    <>
                      <div className="flex gap-2">
                        <Input value={buttonLinks[k] ?? ""} onChange={(e) => setLink(k, e.target.value)} placeholder="Escolha em Links ou cole uma URL https:// (opcional)" />
                        <CampaignLinkPicker channel="whatsapp" sections={BUTTON_LINK_SECTIONS} onInsert={(t) => setLink(k, t.trim())} />
                      </div>
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
            <div className="grid gap-3 md:grid-cols-4">
              <div>
                <Label className="text-xs">Máximo por dia (limite da Meta)</Label>
                <Input type="number" min={1} max={100000} value={perDayText} onChange={(e) => setPerDayText(e.target.value)} placeholder="Vazio = sem limite" />
                {!perDayValid && <p className="text-xs text-destructive mt-1">Use um número inteiro entre 1 e 100.000.</p>}
                <p className="text-[11px] text-muted-foreground mt-1">Número novo começa com {META_NEW_NUMBER_DAILY_LIMIT} a cada 24 h; aumente quando a Meta liberar.</p>
              </div>
              <div>
                <Label className="text-xs">Custo por mensagem (R$)</Label>
                <Input inputMode="decimal" value={costText} onChange={(e) => setCostText(e.target.value)} placeholder="0,35" />
                {!costValid && <p className="text-xs text-destructive mt-1">Valor inválido.</p>}
              </div>
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
              {totalCost != null && (
                <span className="mt-1 flex items-center gap-1 font-medium">
                  <Coins className="w-4 h-4" /> Custo estimado: {brl(totalCost)}
                  <span className="text-xs font-normal text-muted-foreground">({audienceCount} mensagens × {brl(costPerMessage!)})</span>
                </span>
              )}
            </div>
            {plan.slots > 1 && (
              <div className="rounded-md border">
                <p className="border-b px-2 py-1 text-xs font-medium">Lotes de envio</p>
                <ul className="max-h-48 divide-y overflow-y-auto text-xs">
                  {batchesByDay.map((d) => (
                    <li key={d.day} className="flex items-start justify-between gap-2 px-2 py-1">
                      <span className="font-medium">{d.day}</span>
                      <span className="flex-1 text-muted-foreground">{d.times.join(", ")}</span>
                      <span>{d.count} {d.count === 1 ? "mensagem" : "mensagens"}{totalCost != null ? ` · ${brl(estimateCost(d.count, costPerMessage!))}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tooFar && <p className="text-xs text-destructive">Com esse limite o último lote passaria de 60 dias. Aumente o máximo por dia ou divida o público.</p>}
            {plan.movedByWindow && (
              <p className="text-xs text-muted-foreground">Envios só saem entre 07:30 e 19:00 (Brasília); blocos fora desse horário passam para o início do dia seguinte.</p>
            )}
            {audienceCount > META_NEW_NUMBER_DAILY_LIMIT && (!perDay || perDay > META_NEW_NUMBER_DAILY_LIMIT) && (
              <p className="text-xs text-destructive">
                Atenção: o número +55 16 3419-4735 começa com limite de {META_NEW_NUMBER_DAILY_LIMIT} contatos por dia na Meta; acima disso os envios param sem aviso. Deixe "Máximo por dia" em {META_NEW_NUMBER_DAILY_LIMIT} até a Meta liberar mais.
              </p>
            )}
          </div>
        )}

        {tpl && (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <Label className="flex items-center gap-1"><FlaskConical className="w-4 h-4" /> Testar envio</Label>
            <p className="text-xs text-muted-foreground">
              Digite o WhatsApp com DDD (até {MAX_TEST_PHONES}, separados por vírgula). O teste usa este mesmo modelo, imagem e textos, não dispara a campanha e esta configuração continua aberta.
              Vazio = envia para o lead de teste Danilo Henrique.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input value={testPhonesText} onChange={(e) => setTestPhonesText(e.target.value)} inputMode="tel"
                placeholder="Ex.: 16 99999-9999, 31 98888-7777" className="sm:flex-1" />
              <Button type="button" variant="outline" onClick={sendTest} disabled={!contentReady || !testPhonesValid || testing || sending}>
                <Send className="w-4 h-4 mr-1" /> {testing ? "Enviando teste..." : "Enviar teste"}
              </Button>
            </div>
            {testPhones.length > MAX_TEST_PHONES && <p className="text-xs text-destructive">Use no máximo {MAX_TEST_PHONES} números.</p>}
            {testPhoneErrors.length > 0 && <p className="text-xs text-destructive">Número inválido: {testPhoneErrors.join(", ")}. Use DDD + número.</p>}
            {!contentReady && <p className="text-[11px] text-muted-foreground">Preencha nome da campanha, variáveis{needsMedia ? ", imagem" : ""} e botões para liberar o teste.</p>}
            <p className="text-[11px] text-muted-foreground">Campos do lead (ex.: primeiro nome) usam os dados do cadastro com esse telefone; se não houver, usam o valor padrão.</p>
          </div>
        )}

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
          <div className="flex flex-wrap gap-2 justify-end">
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
