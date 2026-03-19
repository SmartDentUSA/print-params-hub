import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

interface LogEntry {
  id: string;
  data_envio: string | null;
  tipo: string | null;
  mensagem_preview: string | null;
  status: string;
  error_details: string | null;
  lead_name: string;
  member_name: string;
}

interface ArrivalEntry {
  id: string;
  hora: string;
  direcao: "Entrada" | "Saída";
  fonte: string;
  lead_name: string;
  evento: string;
  detalhes: string;
}

function classifySource(eventType: string, sourceChannel: string | null, entityType: string | null): { fonte: string; direcao: "Entrada" | "Saída" } {
  const ch = (sourceChannel || "").toLowerCase();
  const et = (eventType || "").toLowerCase();
  const ent = (entityType || "").toLowerCase();

  // Saída
  if (et.includes("sent") || et.includes("envio") || et.includes("sync") || et.includes("campaign")) {
    const fonte = ch.includes("sellflux") ? "SellFlux"
      : ch.includes("piperun") || ent.includes("piperun") ? "PipeRun"
      : ch.includes("waleads") || et.includes("whatsapp") ? "WaLeads"
      : ch.includes("astron") || ent.includes("astron") ? "Astron"
      : ch || "Sistema";
    return { fonte, direcao: "Saída" };
  }

  // Entrada
  const fonte = ch.includes("ecommerce") || ch.includes("loja") || et.includes("order") || et.includes("pedido") ? "E-commerce"
    : ch.includes("waleads") || ch.includes("whatsapp") || et.includes("whatsapp") ? "WaLeads"
    : ch.includes("piperun") || ent.includes("piperun") || et.includes("deal") || et.includes("stage") ? "PipeRun"
    : ch.includes("sellflux") ? "SellFlux"
    : ch.includes("astron") || ent.includes("astron") || et.includes("course") || et.includes("login") ? "Astron"
    : ch.includes("form") || et.includes("form") ? "Formulário"
    : ch.includes("meta") || et.includes("meta_lead") ? "Meta Ads"
    : ch || "Sistema";

  return { fonte, direcao: "Entrada" };
}

function formatEventLabel(eventType: string): string {
  const map: Record<string, string> = {
    order_created: "Pedido criado",
    order_paid: "Pedido pago",
    order_shipped: "Pedido enviado",
    whatsapp_message_received: "Mensagem recebida",
    whatsapp_message_sent: "Mensagem enviada",
    sellflux_campaign_sent: "Campanha enviada",
    deal_created: "Negócio criado",
    deal_updated: "Negócio atualizado",
    stage_changed: "Etapa alterada",
    lead_created: "Lead criado",
    lead_updated: "Lead atualizado",
    form_submitted: "Formulário enviado",
    course_started: "Curso iniciado",
    course_completed: "Curso completado",
    astron_login: "Login Astron",
    cart_abandoned: "Carrinho abandonado",
    meta_lead_created: "Lead Meta criado",
    sdr_contact: "Contato SDR",
  };
  return map[eventType] || eventType.replace(/_/g, " ");
}

export function SmartOpsLogs() {
  const [tab, setTab] = useState("envios");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Arrival log state
  const [arrivals, setArrivals] = useState<ArrivalEntry[]>([]);
  const [arrivalsLoading, setArrivalsLoading] = useState(true);
  const [arrivalsSearch, setArrivalsSearch] = useState("");
  const [leadNameMap, setLeadNameMap] = useState<Map<string, string>>(new Map());

  // ── Envios tab ──
  useEffect(() => {
    const fetchLogs = async () => {
      const { data } = await supabase
        .from("message_logs")
        .select("id, data_envio, tipo, mensagem_preview, status, error_details, lead_id, team_member_id")
        .order("data_envio", { ascending: false })
        .limit(200);

      if (!data?.length) { setLogs([]); setLoading(false); return; }

      const leadIds = [...new Set(data.map((d: any) => d.lead_id).filter(Boolean))];
      const memberIds = [...new Set(data.map((d: any) => d.team_member_id).filter(Boolean))];

      const [leadsRes, membersRes] = await Promise.all([
        leadIds.length ? supabase.from("lia_attendances").select("id, nome").in("id", leadIds) : { data: [] },
        memberIds.length ? supabase.from("team_members").select("id, nome_completo").in("id", memberIds) : { data: [] },
      ]);

      const leadMap = new Map((leadsRes.data || []).map((l: any) => [l.id, l.nome]));
      const memberMap = new Map((membersRes.data || []).map((m: any) => [m.id, m.nome_completo]));

      setLogs(data.map((d: any) => ({
        id: d.id,
        data_envio: d.data_envio,
        tipo: d.tipo,
        mensagem_preview: d.mensagem_preview,
        status: d.status,
        error_details: d.error_details,
        lead_name: leadMap.get(d.lead_id) || "-",
        member_name: memberMap.get(d.team_member_id) || "-",
      })));
      setLoading(false);
    };
    fetchLogs();
  }, []);

  // ── Arrival tab: fetch + realtime ──
  const mapArrivalRow = useCallback((row: any, nameMap: Map<string, string>): ArrivalEntry => {
    const { fonte, direcao } = classifySource(row.event_type || "", row.source_channel, row.entity_type);
    const resolvedName = row.lead_id ? (nameMap.get(row.lead_id) || row.entity_name || "-") : (row.entity_name || "-");
    return {
      id: row.id,
      hora: row.event_timestamp || row.created_at || "",
      direcao,
      fonte,
      lead_name: resolvedName,
      evento: formatEventLabel(row.event_type || ""),
      detalhes: row.event_data?.label || row.event_data?.message_preview || row.entity_name || "",
    };
  }, []);

  useEffect(() => {
    const fetchArrivals = async () => {
      const { data } = await supabase
        .from("lead_activity_log")
        .select("id, event_timestamp, created_at, event_type, source_channel, entity_type, entity_name, event_data")
        .order("event_timestamp", { ascending: false })
        .limit(300);

      setArrivals((data || []).map(mapArrivalRow));
      setArrivalsLoading(false);
    };
    fetchArrivals();

    // Realtime subscription
    const channel = supabase
      .channel("arrival-log-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "lead_activity_log" },
        (payload) => {
          const newEntry = mapArrivalRow(payload.new);
          setArrivals((prev) => [newEntry, ...prev].slice(0, 500));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [mapArrivalRow]);

  // ── Filters ──
  const filteredLogs = search
    ? logs.filter((l) =>
        [l.lead_name, l.member_name, l.tipo, l.mensagem_preview, l.status].some((v) =>
          v?.toLowerCase().includes(search.toLowerCase())
        )
      )
    : logs;

  const filteredArrivals = arrivalsSearch
    ? arrivals.filter((a) =>
        [a.lead_name, a.fonte, a.evento, a.detalhes, a.direcao].some((v) =>
          v?.toLowerCase().includes(arrivalsSearch.toLowerCase())
        )
      )
    : arrivals;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="envios">Logs de Envios</TabsTrigger>
            <TabsTrigger value="chegada">Log de Chegada</TabsTrigger>
          </TabsList>

          {/* ── Tab Envios ── */}
          <TabsContent value="envios">
            <Input placeholder="Buscar por lead, membro, tipo..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm mb-4" />
            {loading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando logs...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Membro</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Preview</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {log.data_envio ? new Date(log.data_envio).toLocaleString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell className="text-sm">{log.lead_name}</TableCell>
                      <TableCell className="text-sm">{log.member_name}</TableCell>
                      <TableCell><Badge variant="outline">{log.tipo || "-"}</Badge></TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{log.mensagem_preview || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === "enviado" ? "default" : log.status === "erro" ? "destructive" : "secondary"}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[150px] truncate">{log.error_details || ""}</TableCell>
                    </TableRow>
                  ))}
                  {filteredLogs.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum log encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          {/* ── Tab Chegada ── */}
          <TabsContent value="chegada">
            <Input placeholder="Buscar por lead, fonte, evento..." value={arrivalsSearch} onChange={(e) => setArrivalsSearch(e.target.value)} className="max-w-sm mb-4" />
            {arrivalsLoading ? (
              <div className="text-center py-12 text-muted-foreground">Carregando log de chegada...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead>Lead</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredArrivals.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {a.hora ? new Date(a.hora).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + " " + new Date(a.hora).toLocaleTimeString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={a.direcao === "Entrada" ? "default" : "secondary"}>
                          {a.direcao}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{a.fonte}</TableCell>
                      <TableCell className="text-sm max-w-[150px] truncate">{a.lead_name}</TableCell>
                      <TableCell className="text-sm">{a.evento}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{a.detalhes}</TableCell>
                    </TableRow>
                  ))}
                  {filteredArrivals.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhum evento encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}