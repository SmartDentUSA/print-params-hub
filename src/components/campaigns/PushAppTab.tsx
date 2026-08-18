import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BellRing, RefreshCw, Send, Clock, Users } from "lucide-react";
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

  const [options, setOptions] = useState<Options>({ ufs: [], stages: [], pipelines: [], owners: [], origens: [], especialidades: [] });
  const [audience, setAudience] = useState<number | null>(null);
  const [counting, setCounting] = useState(false);

  // Mensagem
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");

  // Envio
  const [scheduleAt, setScheduleAt] = useState("");
  const [sending, setSending] = useState(false);
  const [campaigns, setCampaigns] = useState<PushCampaign[]>([]);
  const [totalSubs, setTotalSubs] = useState<number | null>(null);

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
    return f;
  }, [produtoInteresse, cidade, uf, stageName, pipeline, owner, origem, especialidade, clienteFilter, temScanner, temPrinter, platform, recencia, ltvMin, scoreMin]);

  const loadOptions = useCallback(async () => {
    const [subsRes, leadsRes] = await Promise.all([
      supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("enabled", true),
      supabase
        .from("lia_attendances")
        .select("uf, piperun_stage_name, piperun_pipeline_name, proprietario_lead_crm, origem_primeiro_contato, especialidade")
        .is("merged_into", null)
        .limit(1000),
    ]);
    setTotalSubs(subsRes.count ?? 0);
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

  const preview = (tpl: string) =>
    tpl
      .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, "Danilo")
      .replace(/\{\{\s*nome\s*\}\}/gi, "Danilo Henrique")
      .replace(/\{\{\s*cidade\s*\}\}/gi, "Ribeirão Preto")
      .replace(/\{\{\s*produto_interesse\s*\}\}/gi, "Scanner Intraoral");

  const submit = async (mode: "now" | "schedule") => {
    if (!title.trim() || !message.trim()) { toast.error("Preencha o título e a mensagem."); return; }
    if (mode === "schedule") {
      if (!scheduleAt) { toast.error("Escolha a data e hora do envio."); return; }
      const hour = new Date(scheduleAt).getHours();
      if (hour < 6 || hour >= 23) { toast.error("Programe entre 06:00 e 23:00."); return; }
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
        schedule_at: mode === "schedule" ? new Date(scheduleAt).toISOString() : null,
      },
    });
    setSending(false);
    const res = data as { ok?: boolean; error?: string; sent?: number; audience?: number; status?: string } | null;
    if (error || !res?.ok) { toast.error(res?.error || error?.message || "Falha ao enviar."); return; }
    if (res.status === "agendada") toast.success(`Campanha programada para ${res.audience ?? 0} usuários.`);
    else toast.success(`Push enviado para ${res.sent ?? 0} de ${res.audience ?? 0} usuários.`);
    setTitle(""); setMessage(""); setScheduleAt("");
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
                {totalSubs ?? 0} usuários com push ativo no total · notificações só chegam a quem autorizou no app
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
          <CardDescription>Envie agora ou programe entre 06:00 e 23:00.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <Button onClick={() => submit("now")} disabled={sending}>
            <Send className="w-4 h-4 mr-2" />
            {sending ? "Enviando..." : `Enviar agora (${audience ?? 0})`}
          </Button>
          <div className="space-y-1">
            <Label className="text-xs">Programar para</Label>
            <Input type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="w-56" />
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
          <CardDescription>Enviados, falhas e cliques por campanha.</CardDescription>
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