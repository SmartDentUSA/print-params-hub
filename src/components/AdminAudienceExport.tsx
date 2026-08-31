import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Download, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type Source = "leads" | "manual";
type IdKind = "email" | "phone" | "both" | "gaid";
type FileFormat = "csv" | "txt";

const PAGE = 1000;

const LEAD_STATUS_OPTIONS = [
  { value: "all", label: "Todos os status" },
  { value: "CLIENTE_ativo", label: "Clientes ativos" },
  { value: "lead_novo", label: "Leads novos" },
  { value: "em_negociacao", label: "Em negociação" },
  { value: "perdida_renutrir", label: "Perdidos / renutrir" },
];

const PERIOD_OPTIONS = [
  { value: "all", label: "Todo o período" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "180", label: "Últimos 6 meses" },
  { value: "365", label: "Últimos 12 meses" },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeEmail(raw: unknown): string | null {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s || !s.includes("@") || s.includes(" ")) return null;
  return s;
}

function normalizePhone(raw: unknown): string | null {
  let digits = String(raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  // Brazilian numbers without country code (10 or 11 digits)
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return `+${digits}`;
}

async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function maybeHash(values: string[], hash: boolean): Promise<string[]> {
  if (!hash) return values;
  const out: string[] = [];
  for (const v of values) out.push(await sha256Hex(v));
  return out;
}

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function AdminAudienceExport() {
  const { toast } = useToast();

  const [source, setSource] = useState<Source>("leads");
  const [idKind, setIdKind] = useState<IdKind>("email");
  const [format, setFormat] = useState<FileFormat>("csv");
  const [hash, setHash] = useState(true);

  const [leadStatus, setLeadStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [onlyValidEmail, setOnlyValidEmail] = useState(true);
  const [excludeOptOut, setExcludeOptOut] = useState(true);

  const [manualList, setManualList] = useState("");
  const [counts, setCounts] = useState<{ emails: number; phones: number } | null>(null);
  const [counting, setCounting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const sinceIso = useMemo(() => {
    if (period === "all") return null;
    const d = new Date();
    d.setDate(d.getDate() - Number(period));
    return d.toISOString();
  }, [period]);

  const applyFilters = (query: any, column: "email" | "telefone_normalized") => {
    let q = query.is("merged_into", null).not(column, "is", null).neq(column, "");
    if (leadStatus !== "all") q = q.eq("lead_status", leadStatus);
    if (sinceIso) q = q.gte("data_primeiro_contato", sinceIso);
    if (column === "email" && onlyValidEmail) q = q.not("email_bounced", "is", true);
    if (excludeOptOut) {
      if (column === "email") {
        // nothing extra: e-mail opt-out is tracked via bounce
      } else {
        q = q.not("sms_opt_out", "is", true).not("whatsapp_opt_out", "is", true);
      }
    }
    return q;
  };

  // Live eligible counters
  useEffect(() => {
    if (source !== "leads") {
      setCounts(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setCounting(true);
      try {
        const [emailRes, phoneRes] = await Promise.all([
          applyFilters(supabase.from("lia_attendances").select("id", { count: "exact", head: true }), "email"),
          applyFilters(
            supabase.from("lia_attendances").select("id", { count: "exact", head: true }),
            "telefone_normalized",
          ),
        ]);
        if (cancelled) return;
        setCounts({ emails: emailRes.count ?? 0, phones: phoneRes.count ?? 0 });
      } catch (e) {
        if (!cancelled) setCounts(null);
      } finally {
        if (!cancelled) setCounting(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, leadStatus, period, onlyValidEmail, excludeOptOut]);

  const fetchColumn = async (column: "email" | "telefone_normalized"): Promise<string[]> => {
    const values = new Set<string>();
    let from = 0;
    while (true) {
      const { data, error } = await applyFilters(
        supabase.from("lia_attendances").select(column).range(from, from + PAGE - 1),
        column,
      );
      if (error) throw error;
      if (!data?.length) break;
      for (const row of data as any[]) {
        const normalized = column === "email" ? normalizeEmail(row[column]) : normalizePhone(row[column]);
        if (normalized) values.add(normalized);
      }
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return Array.from(values);
  };

  const parseManual = (): { emails: string[]; phones: string[]; gaids: string[]; invalid: number } => {
    const lines = manualList
      .split(/[\n,;]+/)
      .map((l) => l.trim())
      .filter(Boolean);
    const emails = new Set<string>();
    const phones = new Set<string>();
    const gaids = new Set<string>();
    let invalid = 0;
    for (const line of lines) {
      if (idKind === "gaid") {
        if (UUID_RE.test(line)) gaids.add(line.toLowerCase());
        else invalid++;
        continue;
      }
      if (line.includes("@")) {
        const e = normalizeEmail(line);
        if (e) emails.add(e);
        else invalid++;
      } else {
        const p = normalizePhone(line);
        if (p) phones.add(p);
        else invalid++;
      }
    }
    return { emails: [...emails], phones: [...phones], gaids: [...gaids], invalid };
  };

  const handleExport = async () => {
    setExporting(true);
    setLastResult(null);
    try {
      let emails: string[] = [];
      let phones: string[] = [];
      let gaids: string[] = [];
      let invalid = 0;

      if (source === "manual") {
        const parsed = parseManual();
        emails = parsed.emails;
        phones = parsed.phones;
        gaids = parsed.gaids;
        invalid = parsed.invalid;
      } else {
        if (idKind === "gaid") {
          toast({
            title: "GAID não disponível na base",
            description: "A base não armazena Android Advertising IDs. Use a opção 'Lista própria'.",
            variant: "destructive",
          });
          return;
        }
        if (idKind === "email" || idKind === "both") emails = await fetchColumn("email");
        if (idKind === "phone" || idKind === "both") phones = await fetchColumn("telefone_normalized");
      }

      const hashedEmails = await maybeHash(emails, hash);
      const hashedPhones = await maybeHash(phones, hash);
      const hashedGaids = await maybeHash(gaids, hash);

      const suffix = hash ? "_sha256" : "";
      const today = new Date().toISOString().split("T")[0];
      let rows = 0;
      let filename = "";

      if (format === "txt") {
        const values =
          idKind === "gaid" ? hashedGaids : idKind === "phone" ? hashedPhones : hashedEmails;
        if (!values.length) {
          toast({ title: "Nenhum identificador elegível", variant: "destructive" });
          return;
        }
        rows = values.length;
        filename = `audience-${idKind}${suffix}-${today}.txt`;
        download(values.join("\n") + "\n", filename, "text/plain");
      } else {
        const headers: string[] = [];
        const columns: string[][] = [];
        if (idKind === "gaid") {
          headers.push(hash ? "gaid_sha256" : "gaid");
          columns.push(hashedGaids);
        } else {
          if (idKind === "email" || idKind === "both") {
            headers.push(hash ? "email_sha256" : "email");
            columns.push(hashedEmails);
          }
          if (idKind === "phone" || idKind === "both") {
            headers.push(hash ? "phone_sha256" : "phone");
            columns.push(hashedPhones);
          }
        }
        const maxLen = Math.max(0, ...columns.map((c) => c.length));
        if (!maxLen) {
          toast({ title: "Nenhum identificador elegível", variant: "destructive" });
          return;
        }
        const lines = [headers.join(",")];
        for (let i = 0; i < maxLen; i++) {
          lines.push(columns.map((c) => csvEscape(c[i] ?? "")).join(","));
        }
        rows = maxLen;
        filename = `audience-${idKind}${suffix}-${today}.csv`;
        download(lines.join("\n") + "\n", filename, "text/csv");
      }

      setLastResult(
        `${rows} linha(s) exportada(s) em ${filename}${invalid ? ` • ${invalid} valor(es) inválido(s) descartado(s)` : ""}`,
      );
      toast({ title: "Público exportado", description: `${rows} identificador(es) em ${filename}` });
    } catch (error) {
      console.error("[audience-export]", error);
      toast({
        title: "Erro ao exportar público",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="bg-gradient-card border-border shadow-medium md:col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Públicos Personalizados (Ads)
        </CardTitle>
        <CardDescription>
          Gere arquivos de público com e-mails e telefones brutos ou com hash SHA-256, ou GAIDs — em CSV com
          cabeçalhos ou TXT com um valor por linha.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Fonte do público</Label>
            <Select value={source} onValueChange={(v) => setSource(v as Source)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="leads">Base de leads (canônicos)</SelectItem>
                <SelectItem value="manual">Lista própria (colar valores)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Identificador</Label>
            <Select value={idKind} onValueChange={(v) => setIdKind(v as IdKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="phone">Telefone (E.164)</SelectItem>
                <SelectItem value="both">E-mail + Telefone (só CSV)</SelectItem>
                <SelectItem value="gaid">GAID (só lista própria)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Formato do arquivo</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as FileFormat)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="csv">CSV com cabeçalhos</SelectItem>
                <SelectItem value="txt">TXT (um valor por linha)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {format === "txt" && idKind === "both" && (
          <p className="text-xs text-warning">
            No formato TXT escolha um único tipo de identificador. Com "E-mail + Telefone" serão exportados apenas
            os e-mails.
          </p>
        )}

        {source === "leads" && (
          <div className="space-y-4 rounded-lg border border-border p-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Status do lead</Label>
                <Select value={leadStatus} onValueChange={setLeadStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Período (primeiro contato)</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch id="only-valid-email" checked={onlyValidEmail} onCheckedChange={setOnlyValidEmail} />
                <Label htmlFor="only-valid-email" className="text-sm font-normal">
                  Só e-mails válidos (exclui bounced)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="exclude-optout" checked={excludeOptOut} onCheckedChange={setExcludeOptOut} />
                <Label htmlFor="exclude-optout" className="text-sm font-normal">
                  Excluir opt-out de SMS/WhatsApp
                </Label>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {counting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Contando elegíveis…</>
              ) : counts ? (
                <>
                  <Badge variant="outline">{counts.emails.toLocaleString("pt-BR")} e-mails</Badge>
                  <Badge variant="outline">{counts.phones.toLocaleString("pt-BR")} telefones</Badge>
                  <span className="text-xs">elegíveis (antes da deduplicação)</span>
                </>
              ) : null}
            </div>
          </div>
        )}

        {source === "manual" && (
          <div className="space-y-2">
            <Label>Lista própria</Label>
            <Textarea
              value={manualList}
              onChange={(e) => setManualList(e.target.value)}
              rows={6}
              placeholder={
                idKind === "gaid"
                  ? "Um GAID por linha (formato UUID), ex.: 38400000-8cf0-11bd-b23e-10b96e40000d"
                  : "Um valor por linha (e-mails e/ou telefones)"
              }
            />
            <p className="text-xs text-muted-foreground">
              Valores são normalizados, deduplicados e validados. GAIDs precisam estar no formato UUID.
            </p>
          </div>
        )}

        <div className="flex items-start gap-3 rounded-lg bg-muted p-4">
          <ShieldCheck className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-3">
              <Switch id="hash-toggle" checked={hash} onCheckedChange={setHash} />
              <Label htmlFor="hash-toggle" className="text-sm">
                Aplicar hash SHA-256 (recomendado)
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Enviar identificadores brutos ou com hash SHA-256 é equivalente para a plataforma de anúncios — o hash
              é recomendado por privacidade. A normalização (e-mail em minúsculas, telefone em E.164) é sempre
              aplicada antes do hash.
            </p>
          </div>
        </div>

        {lastResult && <p className="text-sm text-muted-foreground">{lastResult}</p>}

        <Button onClick={handleExport} disabled={exporting} className="w-full">
          {exporting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando arquivo…</>
          ) : (
            <><Download className="w-4 h-4 mr-2" /> Exportar público</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
