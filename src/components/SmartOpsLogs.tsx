import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export function SmartOpsLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("message_logs")
        .select("id, data_envio, tipo, mensagem_preview, status, error_details, lead_id, team_member_id")
        .order("data_envio", { ascending: false })
        .limit(200);

      if (!data?.length) { setLogs([]); setLoading(false); return; }

      // Fetch lead and member names
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
    fetch();
  }, []);

  const filtered = search
    ? logs.filter((l) =>
        [l.lead_name, l.member_name, l.tipo, l.mensagem_preview, l.status].some((v) =>
          v?.toLowerCase().includes(search.toLowerCase())
        )
      )
    : logs;

  if (loading) return <div className="text-center py-12 text-muted-foreground">Carregando logs...</div>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs de Envios</CardTitle>
        <Input placeholder="Buscar por lead, membro, tipo..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm mt-2" />
      </CardHeader>
      <CardContent>
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
            {filtered.map((log) => (
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
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum log encontrado</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
