import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { DatePickerInput } from "@/components/smartops/DatePickerInput";
import { BellRing, RefreshCw, Send, Clock, Users, Bookmark, MousePointerClick, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PushCampaign {
  id: string;
  title: string;
  body: string;
  target_url: string | null;
  schedule_at: string | null;
  status: string;
  total_audience: number;
  sent_count: number;
  failed_count: number;
  clicked_count: number;
  created_at: string;
}

type Options = { ufs: string[]; stages: string[]; pipelines: string[]; owners: string[]; origens: string[]; especialidades: string[] };

const ALL = "all";
const clean = (v: string) => (v && v !== ALL ? v : undefined);
const HOURS = Array.from({ length: 18 }, (_, i) => String(i + 6).padStart(2, "0")); // 06h–23h

export function PushAppTab() {
  // Segmentação
  const [produtoInteresse, setProdutoInteresse] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState(ALL);
  const [stageName, setStageName] = useState(ALL);
  const [pipeline, setPipeline] = useState(ALL);
  const [owner, setOwner] = useState(ALL);
  const [origem, setOrigem] = useState(ALL);
  const [especialidade, setEspecialidade] = useState(ALL);
  const [clienteFilter, setClienteFilter] = useState(ALL);
  const [temScanner, setTemScanner] = useState(ALL);
  const [temPrinter, setTemPrinter] = useState(ALL);
  const [platform, setPlatform] = useState(ALL);
  const [recencia, setRecencia] = useState(ALL);
  const [ltvMin, setLtvMin] = useState("");
  const [scoreMin, setScoreMin] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  // Segmentações salvas
  const [segments, setSegments] = useState<Array<{ id: string; name: string; filters: Record<string, string> }>>([]);
  const [segmentName, setSegmentName] = useState("");

  const [options, setOptions] = useState<Options>({ ufs: [], stages: [], pipelines: [], owners: [], origens: [], especialidades: [] });
  const [audience, setAudience] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  // Mensagem
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");

  // Envio (data + hora únicas da campanha)
  const [sendDate, setSendDate] = useState("");
  const [sendHour, setSendHour] = useState("09");
  const [sending, setSending] = useState(false);
  const [campaigns, setCampaigns] = useState<PushCampaign[]>([]);
  const [totalSubs, setTotalSubs] = useState<number | null>(null);
  const [onlineNow, setOnlineNow] = useState<number | null>(null);

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    const put = (k: string, v?: string) => { if (v) f[k] = v; };
    put("produto_interesse", produtoInteresse.trim() || undefined);
    put("cidade", cidade.trim() || undefined);
    put("uf", clean(uf));
    put("piperun_stage_name", clean(stageName));
    put("piperun_pipeline_name", clean(pipeline));
    put("proprietario_lead_crm", clean(owner));
    put("origem_primeiro_contato", clean(origem));
    put("especialidade", clean(especialidade));
    put("cliente_filter", clean(clienteFilter));
    put("tem_scanner", clean(temScanner));
    put("tem_printer", clean(temPrinter));
    put("platform", clean(platform));
    put("recencia_dias", clean(recencia));
    put("ltv_min", ltvMin.trim() || undefined);
    put("score_min", scoreMin.trim() || undefined);
    if (onlineOnly) f.online_only = "true";
    return f;
  }, [produtoInteresse, cidade, uf, stageName, pipeline, owner, origem, especialidade, clienteFilter, temScanner, temPrinter, platform, recencia, ltvMin, scoreMin, onlineOnly]);

  const loadOptions = useCallback(async () => {
    const [subsRes, onlineRes, leadsRes, segRes] = await Promise.all([
      supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("enabled", true),
      supabase
        .from("push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("enabled", true)
        .gte("last_seen_at", new Date(Date.now() - 30 * 60 * 1000).toISOString()),
      supabase
        .from("lia_attendances")
        .select("uf, piperun_stage_name, piperun_pipeline_name, proprietario_lead_crm, origem_primeiro_contato, especialidade")
        .is("merged_into", null)
        .limit(1000),
      supabase.from("campaign_segments").select("id, name, filters").order("name").limit(100),
    ]);
    setTotalSubs(subsRes.count ?? 0);
    setOnlineNow(onlineRes.count ?? 0);
    setSegments((segRes.data ?? []) as Array<{ id: string; name: string; filters: Record<string, string> }>);
    const uniq = (arr: (string | null)[]) => [...new Set(arr.filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const rows = (leadsRes.data ?? []) as Array<Record<string, string | null>>;
    setOptions({
      ufs: uniq(rows.map((r) => r.uf)),
      stages: uniq(rows.map((r) => r.piperun_stage_name)),
      pipelines: uniq(rows.map((r) => r.piperun_pipeline_name)),
      owners: uniq(rows.map((r) => r.proprietario_lead_crm)),
      origens: uniq(rows.map((r) => r.origem_primeiro_contato)),
      especialidades: uniq(rows.map((r) => r.especialidade)),
    });
  }, []);

  const loadCampaigns = useCallback(async () => {
    const { data } = await supabase
      .from("push_campaigns")
      .select("id,title,body,target_url,schedule_at,status,total_audience,sent_count,failed_count,clicked_count,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setCampaigns((data ?? []) as PushCampaign[]);
  }, []);

  const countAudience = useCallback(async () => {
    setCounting(true);
    const { data, error } = await supabase.rpc("fn_count_push_audience", { p_filters: filters });
    if (error) toast.error(`Erro ao contar público: ${error.message}`);
    setAudience(error ? null : ((data as number) ?? 0));
    setCounting(false);
  }, [filters]);

  useEffect(() => { loadOptions(); loadCampaigns(); }, [loadOptions, loadCampaigns]);
  useEffect(() => { countAudience(); }, [countAudience]);

  const totals = useMemo(() => campaigns.reduce(
    (acc, c) => ({
      disparos: acc.disparos + (c.total_audience ?? 0),
      enviados: acc.enviados + (c.sent_count ?? 0),
      falhas: acc.falhas + (c.failed_count ?? 0),
      cliques: acc.cliques + (c.clicked_count ?? 0),
    }),
    { disparos: 0, enviados: 0, falhas: 0, cliques: 0 },
  ), [campaigns]);

  const saveSegment = async () => {
    const name = segmentName.trim();
    if (!name) { toast.error("Dê um nome para a segmentação."); return; }
    const { error } = await supabase.from("campaign_segments").insert({
      name, filters, lead_count: audience ?? 0, last_refreshed_at: new Date().toISOString(),
    });
    if (error) { toast.error(`Erro ao salvar: ${error.message}`); return; }
    toast.success("Segmentação salva.");
    setSegmentName("");
    loadOptions();
  };

  const applySegment = (id: string) => {
    const seg = segments.find((s) => s.id === id);
    if (!seg) return;
    const f = seg.filters ?? {};
    setProdutoInteresse(f.produto_interesse ?? "");
    setCidade(f.cidade ?? "");
    setUf(f.uf ?? ALL);
    setStageName(f.piperun_stage_name ?? ALL);
    setPipeline(f.piperun_pipeline_name ?? ALL);
    setOwner(f.proprietario_lead_crm ?? ALL);
    setOrigem(f.origem_primeiro_contato ?? ALL);
    setEspecialidade(f.especialidade ?? ALL);
    setClienteFilter(f.cliente_filter ?? ALL);
    setTemScanner(f.tem_scanner ?? ALL);
    setTemPrinter(f.tem_printer ?? ALL);
    setPlatform(f.platform ?? ALL);
    setRecencia(f.recencia_dias ?? ALL);
    setLtvMin(f.ltv_min ?? "");
    setScoreMin(f.score_min ?? "");
    setOnlineOnly(!!f.online_only);
    toast.success(`Segmentação "${seg.name}" aplicada.`);
  };

  const preview = (tpl: string) =>
    tpl
      .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, "Danilo")
      .replace(/\{\{\s*nome\s*\}\}/gi, "Danilo Henrique")
      .replace(/\{\{\s*cidade\s*\}\}/gi, "Ribeirão Preto")
      .replace(/\{\{\s*produto_interesse\s*\}\}/gi, "Scanner Intraoral");

  const submit = async (mode: "now" | "schedule") => {
    if (!title.trim() || !message.trim()) { toast.error("Preencha o título e a mensagem."); return; }
    let scheduleIso: string | null = null;
    if (mode === "schedule") {
      if (!sendDate) { toast.error("Escolha a data do envio."); return; }
      const local = new Date(`${sendDate}T${sendHour}:00:00`);
      if (Number.isNaN(local.getTime())) { toast.error("Data inválida."); return; }
      if (local.getTime() < Date.now()) { toast.error("Escolha uma data e hora futuras."); return; }
      scheduleIso = local.toISOString();
    }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("push-campaign-send", {
      body: {
        title: title.trim(),
        body: message.trim(),
        icon_url: iconUrl.trim() || null,
        image_url: imageUrl.trim() || null,
        target_url: targetUrl.trim() || null,
        filters,
        schedule_at: scheduleIso,
      },
    });
    setSending(false);
    const res = data as { ok?: boolean; error?: string; sent?: number; audience?: number; status?: string } | null;
    if (error || !res?.ok) { toast.error(res?.error || error?.message || "Falha ao enviar."); return; }
    if (res.status === "agendada") toast.success(`Campanha programada para ${res.audience ?? 0} usuários.`);
    else toast.success(`Push enviado para ${res.sent ?? 0} de ${res.audience ?? 0} usuários.`);
    setTitle(""); setMessage(""); setSendDate("");
    loadCampaigns();
  };

  const selectField = (label: string, value: string, setValue: (v: string) => void, items: string[], allLabel = "Todos") => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {items.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 1. Segmentação */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5" /> Segmentação de usuários</CardTitle>
              <CardDescription>
                {totalSubs ?? 0} usuários com push ativo · {onlineNow ?? 0} online agora
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base px-3 py-1">
                {counting ? "..." : `${audience ?? 0} usuários`}
              </Badge>
              <Button variant="outline" size="sm" onClick={() => { countAudience(); loadOptions(); }} disabled={counting}>
                <RefreshCw className={`w-4 h-4 ${counting ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Produto de interesse</Label>
            <Input value={produtoInteresse} onChange={(e) => setProdutoInteresse(e.target.value)} placeholder="ex: scanner" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cidade</Label>
            <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="ex: Campinas" />
          </div>
          {selectField("UF", uf, setUf, options.ufs)}
          {selectField("Etapa do funil", stageName, setStageName, options.stages)}
          {selectField("Funil CRM", pipeline, setPipeline, options.pipelines)}
          {selectField("Vendedor", owner, setOwner, options.owners)}
          {selectField("Origem", origem, setOrigem, options.origens)}
          {selectField("Especialidade", especialidade, setEspecialidade, options.especialidades)}
          <div className="space-y-1">
            <Label className="text-xs">Clientes / Leads</Label>
            <Select value={clienteFilter} onValueChange={setClienteFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="clientes">Somente clientes</SelectItem>
                <SelectItem value="leads">Somente leads</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tem scanner</Label>
            <Select value={temScanner} onValueChange={setTemScanner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="yes">Sim</SelectItem>
                <SelectItem value="no">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tem impressora</Label>
            <Select value={temPrinter} onValueChange={setTemPrinter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos</SelectItem>
                <SelectItem value="yes">Sim</SelectItem>
                <SelectItem value="no">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Plataforma</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas</SelectItem>
                <SelectItem value="android">Android / Chrome</SelectItem>
                <SelectItem value="ios">iPhone (app instalado)</SelectItem>
                <SelectItem value="desktop">Computador</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Atividade recente</Label>
            <Select value={recencia} onValueChange={setRecencia}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Qualquer</SelectItem>
                <SelectItem value="7">Últimos 7 dias</SelectItem>
                <SelectItem value="30">Últimos 30 dias</SelectItem>
                <SelectItem value="90">Últimos 90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">LTV mínimo (R$)</Label>
            <Input value={ltvMin} onChange={(e) => setLtvMin(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Score mínimo</Label>
            <Input value={scoreMin} onChange={(e) => setScoreMin(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 md:col-span-2">
            <div>
              <Label className="text-xs flex items-center gap-1"><Radio className="w-3.5 h-3.5" /> Somente usuários online agora</Label>
              <p className="text-[11px] text-muted-foreground">Ativos nos últimos 5 minutos ({onlineNow ?? 0})</p>
            </div>
            <Switch checked={onlineOnly} onCheckedChange={setOnlineOnly} />
          </div>
          <div className="space-y-1 md:col-span-2 lg:col-span-2">
            <Label className="text-xs">Segmentações salvas</Label>
            <div className="flex flex-wrap gap-2">
              <Select onValueChange={applySegment}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Carregar segmentação" /></SelectTrigger>
                <SelectContent>
                  {segments.length === 0
                    ? <SelectItem value="none" disabled>Nenhuma salva</SelectItem>
                    : segments.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input value={segmentName} onChange={(e) => setSegmentName(e.target.value)} placeholder="Nome da segmentação" className="w-52" />
              <Button variant="outline" onClick={saveSegment}>
                <Bookmark className="w-4 h-4 mr-2" /> Salvar segmentação
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Mensagem */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BellRing className="w-5 h-5" /> Mensagem personalizada</CardTitle>
          <CardDescription>Variáveis: {"{{primeiro_nome}}"} · {"{{nome}}"} · {"{{cidade}}"} · {"{{produto_interesse}}"}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Título ({title.length}/60)</Label>
              <Input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="Olá {{primeiro_nome}}, novidade na Smart Dent" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mensagem ({message.length}/160)</Label>
              <Textarea value={message} maxLength={160} rows={3} onChange={(e) => setMessage(e.target.value)} placeholder="Nova turma de treinamento aberta em {{cidade}}. Toque para ver as datas." />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Link de destino</Label>
                <Input value={targetUrl} onChange={(e) => setTargetUrl(e.target.value)} placeholder="https://parametros.smartdent.com.br/agenda" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ícone (URL)</Label>
                <Input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="opcional" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Imagem grande (URL)</Label>
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="opcional" />
            </div>
          </div>

          {/* Pré-visualização */}
          <div className="space-y-2">
            <Label className="text-xs">Pré-visualização no celular</Label>
            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <div className="rounded-lg bg-background shadow-medium p-3 flex gap-3">
                <img src={iconUrl || "/favicon-96x96.png"} alt="Ícone Smart Dent" className="w-10 h-10 rounded" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{preview(title) || "Título da notificação"}</p>
                  <p className="text-xs text-muted-foreground line-clamp-3">{preview(message) || "Texto da mensagem aparece aqui."}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Smart Dent · agora</p>
                </div>
              </div>
              {imageUrl && <img src={imageUrl} alt="Imagem da notificação" className="mt-2 rounded-lg w-full object-cover max-h-40" />}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Envio */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="w-5 h-5" /> Envio</CardTitle>
          <CardDescription>Envie agora ou escolha a data e a hora do disparo desta campanha (06:00–23:00).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Button onClick={() => submit("now")} disabled={sending}>
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Enviando..." : `Enviar agora (${audience ?? 0})`}
          </Button>
          <div className="space-y-1">
            <Label className="text-xs">Data do disparo</Label>
            <DatePickerInput value={sendDate} onChange={setSendDate} className="w-44" placeholder="Escolher data" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Hora</Label>
            <Select value={sendHour} onValueChange={setSendHour}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => <SelectItem key={h} value={h}>{h}:00</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={() => submit("schedule")} disabled={sending}>
            <Clock className="w-4 h-4 mr-2" /> Programar
          </Button>
        </CardContent>
      </Card>

      {/* Histórico */}
      <Card>
        <CardHeader>
          <CardTitle>Campanhas push</CardTitle>
          <CardDescription>Disparos, enviados, falhas e cliques por campanha.</CardDescription>
          <div className="grid gap-3 sm:grid-cols-4 pt-3">
            {[
              { label: "Disparos", value: totals.disparos, icon: Send },
              { label: "Enviados", value: totals.enviados, icon: BellRing },
              { label: "Cliques no push", value: totals.cliques, icon: MousePointerClick },
              { label: "Falhas", value: totals.falhas, icon: Clock },
            ].map((k) => (
              <div key={k.label} className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><k.icon className="w-3.5 h-3.5" /> {k.label}</p>
                <p className="text-2xl font-semibold">{k.value}</p>
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Criada</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Público</TableHead>
                <TableHead>Enviados</TableHead>
                <TableHead>Falhas</TableHead>
                <TableHead>Cliques</TableHead>
                <TableHead>Agendada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma campanha push ainda.</TableCell></TableRow>
              ) : campaigns.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(c.created_at).toLocaleString("pt-BR")}</TableCell>
                  <TableCell className="text-sm max-w-[220px] truncate">{c.title}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "enviada" ? "default" : c.status === "erro" ? "destructive" : "secondary"}>{c.status}</Badge>
                  </TableCell>
                  <TableCell>{c.total_audience}</TableCell>
                  <TableCell>{c.sent_count}</TableCell>
                  <TableCell className="text-destructive">{c.failed_count}</TableCell>
                  <TableCell>{c.clicked_count}</TableCell>
                  <TableCell className="text-xs whitespace-nowrap">
                    {c.schedule_at ? new Date(c.schedule_at).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}