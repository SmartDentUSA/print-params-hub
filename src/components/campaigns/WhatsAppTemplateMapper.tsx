import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Send } from "lucide-react";

export type WaAccount = { accountId: string; profileId: string; name: string | null; phone: string | null };
type Template = { name: string; language: string; category: string; body: string; vars: number };
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

  const tpl = templates.find((t) => `${t.name}|${t.language}` === tplKey);

  useEffect(() => {
    if (!account) return;
    setLoadingTpl(true);
    callWaBroadcast({ action: "templates", accountId: account.accountId })
      .then((d) => setTemplates(d.templates ?? []))
      .catch((e) => toast.error(`Modelos: ${e.message}`))
      .finally(() => setLoadingTpl(false));
  }, [account?.accountId]);

  useEffect(() => {
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

  const canSend = !!account && !!tpl && campaignName.trim() && audienceCount > 0 &&
    vars.every((v) => (v.source === "literal" ? v.value.trim() : v.fallback.trim()));

  const update = (i: number, patch: Partial<VarSpec>) => setVars(vars.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  const send = async () => {
    if (!canSend) return;
    if (!confirm(`Enviar o modelo "${tpl!.name}" para até ${audienceCount} leads?`)) return;
    setSending(true);
    const t = toast.loading("Preparando público e enviando...");
    try {
      const leadIds = await resolveLeadIds();
      const r = await callWaBroadcast({
        action: "send", accountId: account!.accountId, profileId: account!.profileId,
        templateName: tpl!.name, language: tpl!.language, name: campaignName.trim(), description,
        leadIds, variableMap: vars,
      });
      toast.success(`Disparo iniciado: ${r.added} destinatários${r.skipped ? ` (${r.skipped} ignorados)` : ""}`, { id: t });
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

        <div className="flex justify-between">
          <Button variant="outline" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
          <Button onClick={send} disabled={!canSend || sending}>
            <Send className="w-4 h-4 mr-1" /> {sending ? "Enviando..." : `Disparar para ${audienceCount} leads`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
