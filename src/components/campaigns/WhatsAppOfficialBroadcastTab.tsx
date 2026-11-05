import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { RefreshCw, Send } from "lucide-react";

type Account = { accountId: string; profileId: string; name: string | null; phone: string | null };
type Template = { name: string; language: string; category: string; body: string; vars: number };
type Segment = { id: string; name: string; lead_ids: string[] | null; lead_count: number | null };
type Session = { id: string; name: string; status: string | null; lead_count: number | null; sent_count: number | null; failed_count: number | null; created_at: string | null; results: any };

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("zernio-wa-broadcast", { body });
  if (error) {
    let msg = error.message;
    try { msg = (await (error as any).context?.json())?.error ?? msg; } catch { /* */ }
    throw new Error(msg);
  }
  return data as any;
}

export default function WhatsAppOfficialBroadcastTab() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplKey, setTplKey] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segmentId, setSegmentId] = useState("");
  const [name, setName] = useState("");
  const [vars, setVars] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState<Session[]>([]);

  const account = accounts.find((a) => a.accountId === accountId);
  const tpl = templates.find((t) => `${t.name}|${t.language}` === tplKey);
  const segment = segments.find((s) => s.id === segmentId);

  const loadHistory = async () => {
    const { data } = await supabase.from("campaign_sessions")
      .select("id,name,status,lead_count,sent_count,failed_count,created_at,results")
      .eq("channel", "whatsapp_oficial").order("created_at", { ascending: false }).limit(20);
    setHistory((data as any) ?? []);
  };

  useEffect(() => {
    call({ action: "accounts" }).then((d) => {
      setAccounts(d.accounts ?? []);
      if (d.accounts?.length === 1) setAccountId(d.accounts[0].accountId);
    }).catch((e) => toast.error(`Contas WhatsApp: ${e.message}`));
    supabase.from("campaign_segments").select("id,name,lead_ids,lead_count").order("created_at", { ascending: false })
      .then(({ data }) => setSegments((data as any) ?? []));
    loadHistory();
  }, []);

  useEffect(() => {
    if (!accountId) return;
    setTemplates([]); setTplKey("");
    call({ action: "templates", accountId }).then((d) => setTemplates(d.templates ?? []))
      .catch((e) => toast.error(`Modelos: ${e.message}`));
  }, [accountId]);

  useEffect(() => { setVars(Array.from({ length: tpl?.vars ?? 0 }, (_, i) => (i === 0 ? "__name__" : ""))); }, [tplKey]);

  const preview = useMemo(() => {
    if (!tpl) return "";
    return tpl.body.replace(/\{\{(\d+)\}\}/g, (_, n) => {
      const v = vars[Number(n) - 1];
      return v === "__name__" ? "[nome do contato]" : v || `{{${n}}}`;
    });
  }, [tpl, vars]);

  const canSend = account && tpl && segment?.lead_ids?.length && name.trim() && vars.every((v) => v.trim());

  const send = async () => {
    if (!canSend) return;
    if (!confirm(`Enviar o modelo "${tpl!.name}" para ${segment!.lead_ids!.length} leads?`)) return;
    setSending(true);
    const t = toast.loading("Enviando disparo...");
    try {
      const r = await call({
        action: "send", accountId: account!.accountId, profileId: account!.profileId,
        templateName: tpl!.name, language: tpl!.language, name: name.trim(),
        leadIds: segment!.lead_ids, variables: vars,
      });
      toast.success(`Disparo iniciado: ${r.added} destinatários${r.skipped ? ` (${r.skipped} ignorados)` : ""}`, { id: t });
      loadHistory();
    } catch (e: any) {
      toast.error(e.message, { id: t });
    } finally { setSending(false); }
  };

  const refresh = async (id: string) => {
    try { await call({ action: "status", campaignId: id }); loadHistory(); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Disparo em massa — WhatsApp API Oficial</CardTitle>
          <CardDescription>
            Envia um modelo de mensagem aprovado pela Meta pelo número oficial conectado na Zernio.
            Números novos começam com limite de 250 contatos por dia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Número WhatsApp</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue placeholder="Selecione o número" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.accountId} value={a.accountId}>{a.name ?? a.accountId}{a.phone ? ` — ${a.phone}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Modelo aprovado</Label>
              <Select value={tplKey} onValueChange={setTplKey} disabled={!accountId}>
                <SelectTrigger><SelectValue placeholder={templates.length ? "Selecione o modelo" : "Nenhum modelo aprovado"} /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} · {t.language} · {t.category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Público (segmento salvo)</Label>
              <Select value={segmentId} onValueChange={setSegmentId}>
                <SelectTrigger><SelectValue placeholder="Selecione o segmento" /></SelectTrigger>
                <SelectContent>
                  {segments.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.lead_ids?.length ?? s.lead_count ?? 0})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome da campanha</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Convite Imersão Dezembro" />
            </div>
          </div>

          {tpl && vars.length > 0 && (
            <div className="space-y-2">
              <Label>Variáveis do modelo</Label>
              {vars.map((v, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <span className="text-sm w-12">{`{{${i + 1}}}`}</span>
                  <Select value={v === "__name__" ? "__name__" : "fixo"} onValueChange={(x) => setVars(vars.map((o, j) => j === i ? (x === "__name__" ? "__name__" : "") : o))}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__name__">Nome do contato</SelectItem>
                      <SelectItem value="fixo">Texto fixo</SelectItem>
                    </SelectContent>
                  </Select>
                  {v !== "__name__" && (
                    <Input value={v} onChange={(e) => setVars(vars.map((o, j) => j === i ? e.target.value : o))} placeholder="Valor" />
                  )}
                </div>
              ))}
            </div>
          )}

          {tpl && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm whitespace-pre-wrap">{preview || "(modelo sem texto)"}</div>
          )}

          <div className="flex justify-end">
            <Button onClick={send} disabled={!canSend || sending}>
              <Send className="w-4 h-4 mr-1" /> {sending ? "Enviando..." : "Disparar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de disparos oficiais</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {history.length === 0 && <p className="text-sm text-muted-foreground">Nenhum disparo ainda.</p>}
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between border rounded p-2 text-sm gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">{h.name}</div>
                <div className="text-xs text-muted-foreground">
                  {h.results?.template} · {h.created_at ? new Date(h.created_at).toLocaleString("pt-BR") : ""}
                  {h.results?.error ? ` · ${h.results.error}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline">{h.status}</Badge>
                <span className="text-xs">{h.sent_count ?? 0}/{h.lead_count ?? 0} · falhas {h.failed_count ?? 0}</span>
                {h.results?.summary?.read != null && <span className="text-xs">lidas {h.results.summary.read}</span>}
                {h.results?.broadcast_id && (
                  <Button size="sm" variant="ghost" onClick={() => refresh(h.id)}><RefreshCw className="w-3.5 h-3.5" /></Button>
                )}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
