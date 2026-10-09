import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, UserCheck, XCircle, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { STATUS_CONFIG } from "@/lib/courseUtils";

const sb = supabase as any;
const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

async function callManage(action: "cancel" | "promote", id: string) {
  const { data, error } = await supabase.functions.invoke("smartops-waitlist-manage", { body: { action, id } });
  if (error) {
    const d = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let msg = d; try { msg = JSON.parse(d).error ?? d; } catch { /* texto */ }
    throw new Error(msg);
  }
  return data;
}

export function CoursesWaitlistTab() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<{ id: string; name: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["courses-waitlist-tab"],
    queryFn: async () => {
      const { data: courses } = await sb.from("smartops_courses").select("id, title").eq("waitlist_enabled", true).order("title");
      const ids = (courses ?? []).map((c: any) => c.id);
      if (!ids.length) return [];
      const [{ data: turmas }, { data: enr }, { data: wl }] = await Promise.all([
        sb.from("smartops_course_turmas").select("id, label, course_id, slots, enrolled_count").in("course_id", ids),
        sb.from("smartops_course_enrollments").select("id, turma_id, person_name, enrolled_at, created_at, status").in("course_id", ids).order("enrolled_at"),
        sb.from("smartops_turma_waitlist").select("id, turma_id, person_name, phone, created_at, wa_sent_at, vacancy_notified_at, vacancy_error").in("course_id", ids).order("created_at"),
      ]);
      return (courses ?? []).map((c: any) => ({
        ...c,
        turmas: (turmas ?? []).filter((t: any) => t.course_id === c.id).map((t: any) => ({
          ...t,
          enrollments: (enr ?? []).filter((e: any) => e.turma_id === t.id),
          waitlist: (wl ?? []).filter((w: any) => w.turma_id === t.id),
        })),
      }));
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["courses-waitlist-tab"] });
    qc.invalidateQueries({ queryKey: ["v_turmas_com_vagas"] });
  };

  const cancel = async (id: string) => {
    setBusy(id);
    try {
      const r = await callManage("cancel", id);
      const v = r?.vacancy;
      if (v?.notified) toast.success(`Inscrição cancelada. ${v.name} foi avisado(a) da vaga pelo WhatsApp do CS.`);
      else if (v?.name) toast.warning(`Inscrição cancelada, mas não foi possível avisar ${v.name}: ${v.reason}`);
      else toast.success("Inscrição cancelada. Ninguém na lista de espera para avisar.");
    } catch (e) { toast.error(`Não cancelado: ${(e as Error).message}`); }
    setBusy(null); setToCancel(null); refresh();
  };

  const promote = async (id: string) => {
    setBusy(id);
    try { await callManage("promote", id); toast.success("Inscrição confirmada"); }
    catch (e) { toast.error(`Não confirmado: ${(e as Error).message}`); }
    setBusy(null); refresh();
  };

  if (isLoading) return <div className="p-6 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin inline mr-2" />Carregando…</div>;
  if (!data?.length) return <p className="p-6 text-sm text-muted-foreground">Nenhum curso com lista de espera habilitada.</p>;

  return (
    <div className="space-y-4">
      {data.map((c: any) => c.turmas.map((t: any) => {
        const active = t.enrollments.filter((e: any) => e.status !== "cancelado");
        return (
          <Card key={t.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex flex-wrap items-center gap-2">
                {c.title} <span className="text-muted-foreground font-normal">· {t.label}</span>
                <Badge variant="outline">{active.length}/{t.slots ?? "—"} vagas</Badge>
                <Badge variant="secondary" className="gap-1"><Hourglass className="w-3 h-3" />{t.waitlist.length} na espera</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-1">Inscritos</h4>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Nome</TableHead><TableHead>Data da inscrição</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ação</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {t.enrollments.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">Nenhum inscrito.</TableCell></TableRow>}
                    {t.enrollments.map((e: any) => {
                      const st = (STATUS_CONFIG as any)[e.status];
                      return (
                        <TableRow key={e.id} className={e.status === "cancelado" ? "opacity-60" : ""}>
                          <TableCell>{e.person_name || "—"}</TableCell>
                          <TableCell>{fmt(e.enrolled_at || e.created_at)}</TableCell>
                          <TableCell><Badge variant="outline" className={st?.badge}>{st?.label ?? e.status}</Badge></TableCell>
                          <TableCell className="text-right">
                            {e.status !== "cancelado" && (
                              <Button size="sm" variant="outline" className="gap-1" disabled={busy === e.id}
                                onClick={() => setToCancel({ id: e.id, name: e.person_name })}>
                                {busy === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
                                Cancelar inscrição
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-1">Lista de espera</h4>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="w-10">#</TableHead><TableHead>Nome</TableHead><TableHead>Data da inscrição</TableHead><TableHead>Aviso de vaga</TableHead><TableHead className="text-right">Ação</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {t.waitlist.length === 0 && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Ninguém na lista de espera.</TableCell></TableRow>}
                    {t.waitlist.map((w: any, i: number) => (
                      <TableRow key={w.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{w.person_name}<div className="text-xs text-muted-foreground">{w.phone || ""}</div></TableCell>
                        <TableCell>{fmt(w.created_at)}</TableCell>
                        <TableCell>
                          {w.vacancy_notified_at ? <Badge variant="secondary">Avisado {fmt(w.vacancy_notified_at)}</Badge>
                            : w.vacancy_error ? <Badge variant="destructive" title={w.vacancy_error}>Falhou</Badge> : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" className="gap-1" disabled={busy === w.id} onClick={() => promote(w.id)}>
                            {busy === w.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserCheck className="w-3.5 h-3.5" />}
                            Confirmar inscrição
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        );
      }))}

      <AlertDialog open={!!toCancel} onOpenChange={(o) => !o && setToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar inscrição de {toCancel?.name}?</AlertDialogTitle>
            <AlertDialogDescription>O primeiro da lista de espera receberá automaticamente a mensagem do CS avisando sobre a vaga.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => toCancel && cancel(toCancel.id)}>Cancelar inscrição</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
