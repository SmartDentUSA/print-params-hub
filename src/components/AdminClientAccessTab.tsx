import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { KeyRound, RefreshCw, MessageCircle, Mail, Smartphone, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePresenceWatcher } from "@/hooks/useClientPresence";

interface InviteRow {
  destino: string;
  nome: string | null;
  lead_id: string | null;
  canal: string | null;
  sent_at: string;
  status: string | null;
  confirmed_at: string | null;
  last_seen_at: string | null;
  online: boolean | null;
}

const canalIcon = (canal?: string | null) => {
  const c = (canal || "").toLowerCase();
  if (c.includes("whats") || c.includes("wa")) return <MessageCircle className="w-3 h-3 mr-1" />;
  if (c.includes("sms")) return <Smartphone className="w-3 h-3 mr-1" />;
  return <Mail className="w-3 h-3 mr-1" />;
};

const canalLabel = (canal?: string | null) => {
  const c = (canal || "").toLowerCase();
  if (c.includes("whats") || c.includes("wa")) return "WhatsApp";
  if (c.includes("sms")) return "SMS";
  if (c.includes("mail")) return "E-mail";
  return canal || "—";
};

const fmt = (value?: string | null) =>
  value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

export function AdminClientAccessTab() {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "confirmados" | "pendentes" | "online">("todos");
  const { toast } = useToast();
  const { isOnline } = usePresenceWatcher();

  const liveOnline = (r: InviteRow) => isOnline(r.destino) || !!r.online;

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("fn_client_access_invites");
    if (error) {
      toast({ title: "Erro ao carregar acessos", description: error.message, variant: "destructive" });
      setRows([]);
    } else {
      setRows((data as InviteRow[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const term = search.trim().toLowerCase();
  // Apenas o último registro por destino (celular/e-mail)
  const latestByDestino = Array.from(
    rows.reduce((map, r) => {
      const key = (r.destino || "").trim().toLowerCase();
      const current = map.get(key);
      if (!current || new Date(r.sent_at).getTime() > new Date(current.sent_at).getTime()) map.set(key, r);
      return map;
    }, new Map<string, InviteRow>()).values()
  ).sort((a, b) => new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime());

  const filtered = latestByDestino.filter((r) => {
    if (term && !`${r.nome ?? ""} ${r.destino ?? ""}`.toLowerCase().includes(term)) return false;
    if (filter === "confirmados") return !!r.confirmed_at;
    if (filter === "pendentes") return !r.confirmed_at;
    if (filter === "online") return liveOnline(r);
    return true;
  });

  const total = latestByDestino.length;
  const confirmados = latestByDestino.filter((r) => r.confirmed_at).length;
  const onlineCount = latestByDestino.filter(liveOnline).length;

  return (
    <Card className="bg-gradient-card border-border shadow-medium">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5" />
              Acessos enviados aos clientes
            </CardTitle>
            <CardDescription>
              {total} envios · {confirmados} confirmados · {onlineCount} online agora (tempo real)
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Buscar nome, celular ou e-mail"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-64"
            />
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(v) => v && setFilter(v as typeof filter)}
              size="sm"
            >
              <ToggleGroupItem value="todos">Todos</ToggleGroupItem>
              <ToggleGroupItem value="confirmados">Confirmados</ToggleGroupItem>
              <ToggleGroupItem value="pendentes">Pendentes</ToggleGroupItem>
              <ToggleGroupItem value="online">Online</ToggleGroupItem>
            </ToggleGroup>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Enviado em</TableHead>
                <TableHead>Entrega</TableHead>
                <TableHead>Confirmou</TableHead>
                <TableHead>Última atividade</TableHead>
                <TableHead>Online</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum acesso enviado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r, i) => (
                  <TableRow key={`${r.destino}-${r.sent_at}-${i}`}>
                    <TableCell className="font-medium">{r.nome || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.destino}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {canalIcon(r.canal)}
                        {canalLabel(r.canal)}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmt(r.sent_at)}</TableCell>
                    <TableCell>
                      <Badge variant={r.status === "erro" ? "destructive" : "outline"}>
                        {r.status || "enviado"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.confirmed_at ? (
                        <Badge>{fmt(r.confirmed_at)}</Badge>
                      ) : (
                        <Badge variant="secondary">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {fmt(r.last_seen_at)}
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-xs">
                        <Circle
                          className={`w-2 h-2 ${liveOnline(r) ? "fill-primary text-primary animate-pulse" : "fill-muted-foreground text-muted-foreground"}`}
                        />
                        {liveOnline(r) ? "Online" : "Offline"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
