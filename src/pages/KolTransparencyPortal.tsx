import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const fmtH = (n: any) => Number(n || 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const KEY = "kol_tp_session";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR") : "—");
const EVT: Record<string, string> = {
  kol_portal_login: "Acesso ao portal", kol_portal_login_failed: "Tentativa de acesso recusada", kol_portal_new_device_alert: "Aviso de aparelho novo",
  kol_contract_draft_generated: "Contrato preparado", kol_contract_sent: "Contrato enviado", kol_contract_signed: "Contrato aceito",
  kol_image_term_signed: "Termo de imagem aceito", kol_portal_unlocked: "Portal liberado", kol_portal_accept: "Aceite pelo portal",
  kol_group_created: "Grupo de WhatsApp", kol_contract_accept_blocked: "Aceite bloqueado", kol_statement_viewed: "Extrato visualizado",
  kol_contest_opened: "Contestação aberta", kol_contest_answered: "Contestação respondida", kol_commission_changed: "Comissão alterada", kol_commission_defaults_copied: "Comissão padrão aplicada",
  kol_talk_scheduled: "Palestra agendada", kol_stand_scheduled: "Estande agendado", kol_schedule_cancelled: "Horário cancelado",
};
const CANAL: Record<string, string> = { indicacao: "Indicação", cupom: "Cupom e-commerce", formulario: "Formulários do profissional" };

async function call(action: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await supabase.functions.invoke("kol-transparency", {
    body: { action, session_token: sessionStorage.getItem(KEY) ?? "", ...extra },
  });
  if (error) {
    let msg = error.message;
    try { const b = await (error as any).context?.json(); msg = b?.error ?? msg; } catch { /* noop */ }
    throw new Error(msg);
  }
  return data;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <AccordionItem value={id} className="rounded-lg border bg-card px-3">
      <AccordionTrigger className="text-sm font-semibold">{title}</AccordionTrigger>
      <AccordionContent className="text-sm">{children}</AccordionContent>
    </AccordionItem>
  );
}

const Empty = ({ t }: { t: string }) => <p className="text-muted-foreground">{t}</p>;

export default function KolTransparencyPortal() {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(KEY));
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [d, setD] = useState<any>(null);
  const [checks, setChecks] = useState({ contrato: false, imagem: false, lgpd: false });
  const [contest, setContest] = useState({ subject_type: "venda", subject_ref: "", reason: "" });

  useEffect(() => { document.title = "Portal do KOL | Smart Dent"; }, []);

  const load = useCallback(async () => {
    try { setD(await call("data")); } catch (e: any) {
      sessionStorage.removeItem(KEY); setToken(null); toast.error(e.message);
    }
  }, []);
  useEffect(() => { if (token) load(); }, [token, load]);

  const login = async () => {
    setBusy(true);
    try {
      const r = await call("login", { phone });
      sessionStorage.setItem(KEY, r.session_token); setToken(r.session_token);
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const logout = async () => { try { await call("logout"); } catch { /* noop */ } sessionStorage.removeItem(KEY); setToken(null); setD(null); };
  const accept = async () => {
    setBusy(true);
    try { await call("accept", { checks }); toast.success("Contrato aceito e registrado."); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };
  const sendContest = async () => {
    setBusy(true);
    try { await call("contest", contest); toast.success("Contestação enviada à equipe."); setContest({ subject_type: "venda", subject_ref: "", reason: "" }); await load(); }
    catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  if (!token) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
          <div className="space-y-1">
            <h1 className="text-xl font-bold">Portal do KOL</h1>
            <p className="text-sm text-muted-foreground">Entre com o seu celular cadastrado na Smart Dent.</p>
          </div>
          <Input inputMode="tel" placeholder="(16) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
          <Button className="w-full" onClick={login} disabled={busy}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Entrar</Button>
        </div>
      </main>
    );
  }

  if (!d) return <main className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></main>;

  const header = (
    <header className="flex items-center justify-between gap-2">
      <div>
        <p className="text-xs text-muted-foreground">Portal do KOL · Smart Dent</p>
        <h1 className="text-lg font-bold leading-tight">{d.kol?.nome}</h1>
      </div>
      <Button size="sm" variant="ghost" onClick={logout}><LogOut className="h-4 w-4" /></Button>
    </header>
  );

  if (!d.signed) {
    return (
      <main className="min-h-screen bg-background p-4 max-w-3xl mx-auto space-y-4">
        {header}
        {!d.contrato ? <Empty t="Nenhum contrato disponível ainda. A equipe Smart Dent vai te avisar." /> : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-3">
              <p className="text-sm font-semibold">Contrato nº {d.contrato.numero} · versão {d.contrato.versao}</p>
              <pre className="mt-2 max-h-[55vh] overflow-y-auto whitespace-pre-wrap break-words text-xs leading-relaxed font-sans">{d.contrato.texto}</pre>
            </div>
            <div className="space-y-3 rounded-lg border bg-card p-3 text-sm">
              {([
                ["contrato", "Li e aceito o Contrato de KOL."],
                ["imagem", "Li e aceito o Termo de uso de imagem, voz e nome (Anexo III)."],
                ["lgpd", "Autorizo o tratamento dos meus dados conforme a LGPD."],
              ] as const).map(([k, label]) => (
                <label key={k} className="flex items-start gap-2">
                  <Checkbox checked={checks[k]} onCheckedChange={(v) => setChecks((c) => ({ ...c, [k]: v === true }))} />
                  <span>{label}</span>
                </label>
              ))}
              <Button className="w-full" disabled={busy || !checks.contrato || !checks.imagem || !checks.lgpd} onClick={accept}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Aceitar contrato
              </Button>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background p-4 max-w-3xl mx-auto space-y-4">
      {header}
      <Accordion type="multiple" defaultValue={["contrato"]} className="space-y-2">
        <Section id="contrato" title="Contrato">
          <div className="space-y-1">
            <p><ShieldCheck className="inline h-4 w-4 mr-1 text-primary" />Nº {d.contrato.numero} · aceito em {dt(d.contrato.assinado_em)}</p>
            <p className="text-muted-foreground break-all">Código de integridade: {d.contrato.hash}</p>
            <p>Termo de imagem aceito em {dt(d.contrato.termo_imagem_em)}</p>
            <p>Chave PIX (somente leitura): <span className="font-mono">{d.contrato.pix || "—"}</span></p>
            <details className="pt-2"><summary className="cursor-pointer text-primary">Ler o contrato</summary>
              <pre className="mt-2 max-h-[50vh] overflow-y-auto whitespace-pre-wrap break-words text-xs font-sans">{d.contrato.texto}</pre>
            </details>
          </div>
        </Section>

        <Section id="comissao" title="Comissão vigente">
          {d.comissao.length === 0 ? <Empty t="Nenhuma regra ativa." /> : (
            <ul className="divide-y">
              {d.comissao.map((r: any, i: number) => (
                <li key={i} className="py-2 flex justify-between gap-2">
                  <span><Badge variant="secondary" className="mr-1">{CANAL[r.canal] ?? r.canal}</Badge>{r.categoria}{r.subcategoria && ` · ${r.subcategoria}`}</span>
                  <span className="font-semibold whitespace-nowrap">{r.percent}%{r.desconto_cupom != null && r.canal === "cupom" ? ` · cliente ${r.desconto_cupom}%` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section id="indicacoes" title={`Indicações e vendas (${d.indicacoes.length} / ${d.vendas.length})`}>
          <p className="font-medium">Indicações</p>
          {d.indicacoes.length === 0 ? <Empty t="Nenhuma indicação ainda." /> : (
            <ul className="divide-y mb-3">{d.indicacoes.map((x: any) => (
              <li key={x.ref} className="py-1.5 flex justify-between"><span>{x.nome} <span className="text-muted-foreground text-xs">desde {dt(x.desde)}</span></span><Badge variant="outline">{x.situacao}</Badge></li>
            ))}</ul>
          )}
          <p className="font-medium">Vendas atribuídas</p>
          {d.vendas.length === 0 ? <Empty t="Nenhuma venda atribuída ainda." /> : (
            <ul className="divide-y">{d.vendas.map((v: any) => (
              <li key={v.ref} className="py-1.5 flex justify-between gap-2">
                <span>{v.cliente} <span className="text-xs text-muted-foreground">{dt(v.data)} · {v.origem === "cupom" ? `cupom ${v.cupom}` : "formulário"}</span></span>
                <span className="flex items-center gap-2"><span className="font-semibold">{brl(v.valor)}</span>
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setContest({ subject_type: "venda", subject_ref: v.ref, reason: "" }); document.getElementById("contestar")?.scrollIntoView({ behavior: "smooth" }); }}>Contestar</Button>
                </span>
              </li>
            ))}</ul>
          )}
        </Section>

        <Section id="extrato" title="Extrato">
          <div onClick={() => call("view_statement").catch(() => {})}>
            <Badge>Em breve</Badge>
            <p className="mt-2 text-muted-foreground">O extrato completo de comissões estará disponível em breve. Enquanto isso, confira a comissão vigente e as vendas atribuídas acima.</p>
          </div>
        </Section>

        <Section id="eventos" title="Eventos e horas">
          {d.horas && (
            <p className="text-sm mb-2">Horas realizadas: <strong>{fmtH(d.horas.total)} h</strong> <span className="text-xs text-muted-foreground">(palestra {fmtH(d.horas.palestra)} h · estande {fmtH(d.horas.estande)} h)</span></p>
          )}
          {d.eventos.length === 0 ? <Empty t="Nenhuma participação registrada." /> : (
            <ul className="divide-y">{d.eventos.map((e: any, i: number) => {
              const when = e.data ? `${String(e.data).split("-").reverse().join("/")} · ${e.inicio}–${e.fim}` : dt(e.em);
              const sit = e.situacao === "realizado" ? `Realizado · ${fmtH(e.horas)} h` : e.situacao === "cancelado" ? "Cancelado" : "Agendado";
              return (
                <li key={i} className="py-1.5">{e.tipo === "palestra" ? "Palestra" : "Estande"} · {e.evento || "Evento"} <span className="text-xs text-muted-foreground">{when} · {sit}</span></li>
              );
            })}</ul>
          )}
        </Section>

        <Section id="cursos" title="Cursos">
          {d.cursos.length === 0 ? <Empty t="Nenhum curso cadastrado." /> : (
            <ul className="divide-y">{d.cursos.map((c: any, i: number) => (
              <li key={i} className="py-1.5 flex justify-between gap-2"><span>{c.title} <span className="text-xs text-muted-foreground">{dt(c.start_date)}</span></span><span className="text-xs whitespace-nowrap">{c.enrolled_count ?? 0}/{c.max_students ?? "—"} · {c.views_count ?? 0} views</span></li>
            ))}</ul>
          )}
        </Section>

        <Section id="equipamentos" title="Equipamentos">
          {d.equipamentos.length === 0 ? <Empty t="Nenhum equipamento em comodato." /> : (
            <ul className="divide-y">{d.equipamentos.map((e: any, i: number) => (
              <li key={i} className="py-1.5">{e.product_name} · série {e.serial_number || "—"} <span className="text-xs text-muted-foreground">desde {dt(e.released_at)} · {e.status}</span></li>
            ))}</ul>
          )}
        </Section>

        <Section id="atividade" title="Minha atividade">
          <div className="grid grid-cols-2 gap-2">
            {[["Acessos ao portal", d.atividade.logins], ["Indicações", d.atividade.indicacoes], ["Vendas", d.atividade.vendas], ["Cursos", d.atividade.cursos], ["Visitas aos cursos", d.atividade.visitas_cursos]].map(([l, v]) => (
              <div key={l as string} className="rounded-md border p-2"><p className="text-xs text-muted-foreground">{l}</p><p className="text-lg font-bold">{v as number}</p></div>
            ))}
          </div>
        </Section>

        <Section id="timeline" title="Linha do tempo">
          <ul className="space-y-1">{d.linha_do_tempo.map((t: any, i: number) => (
            <li key={i} className="flex justify-between gap-2"><span>{EVT[t.tipo] ?? t.descricao ?? t.tipo.replace(/^kol_/, "").replace(/_/g, " ")}</span><span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(t.em).toLocaleString("pt-BR")}</span></li>
          ))}</ul>
        </Section>

        <Section id="contestar" title="Contestar">
          <div id="contestar" className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <select className="h-9 rounded-md border bg-background px-2 text-sm" value={contest.subject_type} onChange={(e) => setContest((c) => ({ ...c, subject_type: e.target.value }))}>
                <option value="venda">Venda</option><option value="comissao">Comissão</option><option value="indicacao">Indicação</option><option value="outro">Outro</option>
              </select>
              <Input placeholder="Referência (opcional)" value={contest.subject_ref} onChange={(e) => setContest((c) => ({ ...c, subject_ref: e.target.value }))} />
            </div>
            <Textarea placeholder="Explique o que está incorreto" value={contest.reason} onChange={(e) => setContest((c) => ({ ...c, reason: e.target.value }))} />
            <Button className="w-full" disabled={busy || contest.reason.trim().length < 10} onClick={sendContest}>Enviar contestação</Button>
            {d.contestacoes.length > 0 && (
              <ul className="divide-y pt-2">{d.contestacoes.map((c: any) => (
                <li key={c.id} className="py-1.5"><Badge variant="outline" className="mr-1">{c.decision || c.status}</Badge>{c.subject_type}{c.subject_ref && ` · ${c.subject_ref}`} — {c.reason}{c.staff_response && <p className="text-xs text-muted-foreground">Resposta: {c.staff_response}</p>}</li>
              ))}</ul>
            )}
          </div>
        </Section>
      </Accordion>
    </main>
  );
}
