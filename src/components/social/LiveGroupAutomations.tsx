import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2, Plus, Radio, Save, Send, Trash2, Users2 } from 'lucide-react';

type Automation = {
  id: string;
  name: string;
  enabled: boolean;
  group_ids: string[];
  course_ids: string[];
  promo_enabled: boolean;
  promo_days_before: number;
  promo_time: string;
  promo_template: string | null;
  live_enabled: boolean;
  live_minutes_before: number;
  live_template: string | null;
  instance_names: string[] | null;
};

type GroupRow = { id: string; group_jid: string; name: string; member_count: number | null; instance_name: string };
type CourseRow = { id: string; title: string; category: string | null; modality: string | null };
type TurmaRow = {
  id: string;
  label: string;
  turma_number: number | null;
  start_date: string | null;
  live_url: string | null;
  live_thumbnail_url: string | null;
  course_id: string;
};

const DEFAULT_PROMO = `🔴 *AMANHÃ TEM LIVE* — {{titulo}}

📅 {{data}} às {{hora}} (horário de Brasília)
🎥 Transmissão ao vivo no YouTube
🎓 Com {{instrutor}}

👉 Garanta sua vaga: {{inscricao}}`;

const DEFAULT_LIVE = `🔴 *ESTAMOS AO VIVO EM 5 MINUTOS!*

{{titulo}}

▶️ Entre agora: {{live_url}}`;

export function LiveGroupAutomations() {
  const [autos, setAutos] = useState<Automation[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [turmas, setTurmas] = useState<TurmaRow[]>([]);
  const [logs, setLogs] = useState<{ turma_id: string; kind: string; sent_at: string; send_uid: string | null; status: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const load = useCallback(async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [a, g, c, t, l] = await Promise.all([
      supabase.from('live_group_automations').select('*').order('created_at'),
      supabase.from('v_post_group_targets_detail').select('group_id, group_jid, group_name, member_count, instance_name'),
      supabase.from('smartops_courses').select('id, title, category, modality').eq('active', true).order('title'),
      supabase
        .from('smartops_course_turmas')
        .select('id, label, turma_number, start_date, live_url, live_thumbnail_url, course_id')
        .eq('active', true)
        .gte('start_date', today)
        .order('start_date')
        .limit(30),
      supabase.from('live_group_blast_log').select('turma_id, kind, sent_at, send_uid, status').order('sent_at', { ascending: false }).limit(200),
    ]);
    setAutos((a.data as Automation[]) ?? []);
    const seen = new Set<string>();
    const gs: GroupRow[] = [];
    for (const r of (g.data as any[]) ?? []) {
      if (!r.group_id || seen.has(r.group_id)) continue;
      seen.add(r.group_id);
      gs.push({ id: r.group_id, group_jid: r.group_jid, name: r.group_name, member_count: r.member_count, instance_name: r.instance_name });
    }
    gs.sort((x, y) => (y.member_count ?? 0) - (x.member_count ?? 0));
    setGroups(gs);
    setCourses((c.data as CourseRow[]) ?? []);
    setTurmas((t.data as TurmaRow[]) ?? []);
    setLogs((l.data as any[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const liveCourses = useMemo(
    () => courses.filter((c) => /live|online/i.test(`${c.category ?? ''} ${c.modality ?? ''}`)),
    [courses],
  );

  // Somente lives futuras (a partir de hoje), em ordem cronológica
  const upcoming = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return turmas
      .filter((t) => !!t.start_date && t.start_date >= today)
      .sort((x, y) => (x.start_date ?? '').localeCompare(y.start_date ?? ''));
  }, [turmas]);

  // Instâncias disponíveis (derivadas dos grupos configurados em Post Grupos)
  const instanceOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groups) {
      if (!g.instance_name) continue;
      m.set(g.instance_name, (m.get(g.instance_name) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [groups]);

  const create = async () => {
    const { error } = await supabase.from('live_group_automations').insert({
      name: 'Divulgação de Lives',
      promo_template: DEFAULT_PROMO,
      live_template: DEFAULT_LIVE,
    });
    if (error) return toast.error(error.message);
    toast.success('Automação criada');
    load();
  };

  const patch = (id: string, fields: Partial<Automation>) =>
    setAutos((prev) => prev.map((a) => (a.id === id ? { ...a, ...fields } : a)));

  const save = async (a: Automation) => {
    setSaving(a.id);
    const { id, ...rest } = a;
    const { error } = await supabase.from('live_group_automations').update(rest).eq('id', id);
    setSaving(null);
    if (error) return toast.error(error.message);
    toast.success('Automação salva');
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('live_group_automations').delete().eq('id', id);
    if (error) return toast.error(error.message);
    setAutos((p) => p.filter((a) => a.id !== id));
  };

  const preview = async (a: Automation, turmaId: string, kind: 'promo' | 'live') => {
    setTesting(a.id);
    const { data, error } = await supabase.functions.invoke('live-group-blast-cron', {
      body: { dry_run: true, turma_id: turmaId, kind },
    });
    setTesting(null);
    if (error) return toast.error(error.message);
    const r = (data as any)?.results?.find((x: any) => x.automation === a.id);
    if (!r) return toast.error('Nenhuma prévia gerada (verifique grupos e a live selecionada).');
    toast.success(`Prévia para ${r.groups} grupo(s)`, { description: r.text, duration: 12000 });
  };

  const dispatchNow = async (turmaId: string, kind: 'promo' | 'live') => {
    setTesting(turmaId + kind);
    const { data, error } = await supabase.functions.invoke('live-group-blast-cron', {
      body: { turma_id: turmaId, kind },
    });
    setTesting(null);
    if (error) return toast.error(error.message);
    const sent = (data as any)?.sent ?? 0;
    sent > 0 ? toast.success(`Disparo enfileirado (${sent})`) : toast.warning('Nada enviado (já disparado ou sem grupos elegíveis)');
    load();
  };

  const sendTest = async (turmaId: string) => {
    const phone = (testPhone ?? '').replace(/\D/g, '');
    if (phone.length < 10) return toast.error('Informe um telefone válido com DDD.');
    setTesting(turmaId + 'test');
    const { data, error } = await supabase.functions.invoke('live-group-blast-cron', {
      body: { turma_id: turmaId, test_phone: phone },
    });
    setTesting(null);
    if (error) return toast.error(error.message);
    const rs = ((data as any)?.results ?? []).filter((r: any) => r.test_phone);
    const ok = rs.filter((r: any) => r.ok).length;
    if (ok === 0) return toast.error('Teste não enviado', { description: rs[0]?.error ? String(rs[0].error) : 'sem mensagens elegíveis' });
    toast.success(`${ok} mensagem(ns) de teste enviada(s) para ${phone}`);
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Carregando…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Divulgação automática das lives nos grupos selecionados: propaganda no dia anterior às 08:30 e
          lembrete “estamos ao vivo” 5 minutos antes — sempre com o thumb do YouTube da live.
        </p>
        <Button onClick={create} size="sm"><Plus className="w-4 h-4 mr-1" /> Nova automação</Button>
      </div>

      {autos.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
          Nenhuma automação de lives criada ainda.
        </CardContent></Card>
      )}

      {autos.map((a) => (
        <Card key={a.id}>
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Radio className={`w-4 h-4 ${a.enabled ? 'text-red-500' : 'text-muted-foreground'}`} />
              <Input
                value={a.name}
                onChange={(e) => patch(a.id, { name: e.target.value })}
                className="h-8 w-64"
              />
              <Badge variant={a.enabled ? 'default' : 'outline'}>{a.enabled ? 'Ativa' : 'Pausada'}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <Switch checked={a.enabled} onCheckedChange={(v) => patch(a.id, { enabled: v })} />
              <Button size="sm" variant="outline" onClick={() => save(a)} disabled={saving === a.id}>
                {saving === a.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => remove(a.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Grupos */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Users2 className="w-4 h-4" /> Grupos selecionados ({a.group_ids?.length ?? 0})</Label>
              <div className="max-h-56 overflow-auto rounded-md border divide-y">
                {groups.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nenhum grupo disponível — adicione grupos na aba Instâncias.</div>}
                {groups.map((g) => {
                  const checked = (a.group_ids ?? []).includes(g.id);
                  return (
                    <label key={g.id} className="flex items-center gap-3 p-2 text-sm cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          patch(a.id, {
                            group_ids: v
                              ? [...(a.group_ids ?? []), g.id]
                              : (a.group_ids ?? []).filter((x) => x !== g.id),
                          })
                        }
                      />
                      <span className="flex-1 truncate">{g.name}</span>
                      <span className="text-xs text-muted-foreground">{g.instance_name}</span>
                      <Badge variant="outline" className="tabular-nums">{g.member_count ?? 0}</Badge>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Lives elegíveis */}
            <div className="space-y-2">
              <Label>Lives incluídas ({a.course_ids?.length ? `${a.course_ids.length} selecionadas` : 'todas'})</Label>
              <div className="max-h-40 overflow-auto rounded-md border divide-y">
                {liveCourses.map((c) => {
                  const checked = (a.course_ids ?? []).includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-3 p-2 text-sm cursor-pointer hover:bg-muted/50">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          patch(a.id, {
                            course_ids: v
                              ? [...(a.course_ids ?? []), c.id]
                              : (a.course_ids ?? []).filter((x) => x !== c.id),
                          })
                        }
                      />
                      <span className="flex-1 truncate">{c.title}</span>
                      <span className="text-xs text-muted-foreground">{c.category ?? c.modality}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Propaganda D-1 */}
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">1️⃣ Propaganda antes da live</Label>
                <Switch checked={a.promo_enabled} onCheckedChange={(v) => patch(a.id, { promo_enabled: v })} />
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Dias antes</Label>
                  <Input type="number" min={0} className="w-24" value={a.promo_days_before}
                    onChange={(e) => patch(a.id, { promo_days_before: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Horário (Brasília)</Label>
                  <Input type="time" className="w-32" value={(a.promo_time ?? '08:30').slice(0, 5)}
                    onChange={(e) => patch(a.id, { promo_time: e.target.value })} />
                </div>
              </div>
              <Textarea rows={7} value={a.promo_template ?? DEFAULT_PROMO}
                onChange={(e) => patch(a.id, { promo_template: e.target.value })} />
            </div>

            {/* Lembrete ao vivo */}
            <div className="rounded-md border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">2️⃣ Lembrete “estamos ao vivo”</Label>
                <Switch checked={a.live_enabled} onCheckedChange={(v) => patch(a.id, { live_enabled: v })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Minutos antes do início</Label>
                <Input type="number" min={1} className="w-24" value={a.live_minutes_before}
                  onChange={(e) => patch(a.id, { live_minutes_before: Number(e.target.value) })} />
              </div>
              <Textarea rows={5} value={a.live_template ?? DEFAULT_LIVE}
                onChange={(e) => patch(a.id, { live_template: e.target.value })} />
              <p className="text-xs text-muted-foreground">
                Variáveis: {'{{titulo}}'} {'{{data}}'} {'{{hora}}'} {'{{instrutor}}'} {'{{live_url}}'} {'{{inscricao}}'} {'{{turma}}'}
              </p>
            </div>

            {/* Próximas lives */}
            <div className="space-y-2">
              <Label>Próximas lives</Label>
              <div className="rounded-md border divide-y">
                {upcoming.length === 0 && <div className="p-3 text-sm text-muted-foreground">Nenhuma live futura agendada.</div>}
                {upcoming
                  .filter((t) => !a.course_ids?.length || a.course_ids.includes(t.course_id))
                  .map((t) => {
                    const sends = logs.filter((l) => l.turma_id === t.id);
                    const promo = sends.find((l) => l.kind === 'promo');
                    const live = sends.find((l) => l.kind === 'live');
                    return (
                      <div key={t.id} className="flex items-center gap-3 p-2 text-sm flex-wrap">
                        {t.live_thumbnail_url ? (
                          <img src={t.live_thumbnail_url} alt={t.label} className="w-16 h-9 object-cover rounded" loading="lazy" />
                        ) : (
                          <div className="w-16 h-9 rounded bg-muted" />
                        )}
                        <span className="flex-1 truncate">
                          {t.turma_number ? `#${t.turma_number} · ` : ''}{t.label}
                        </span>
                        <span className="text-xs text-muted-foreground">{t.start_date}</span>
                        {t.live_url ? <Badge variant="outline">YouTube</Badge> : <Badge variant="destructive">sem live_url</Badge>}
                        {promo && (
                          <Badge variant={promo.status === 'failed' ? 'destructive' : 'secondary'} title={promo.send_uid ?? ''}>
                            propaganda {promo.status === 'failed' ? 'falhou' : 'enviada'} · {promo.send_uid ?? '—'}
                          </Badge>
                        )}
                        {live && (
                          <Badge variant={live.status === 'failed' ? 'destructive' : 'secondary'} title={live.send_uid ?? ''}>
                            lembrete {live.status === 'failed' ? 'falhou' : 'enviado'} · {live.send_uid ?? '—'}
                          </Badge>
                        )}
                        <Button size="sm" variant="ghost" disabled={testing === a.id}
                          onClick={() => preview(a, t.id, 'promo')}>Prévia</Button>
                        <Button size="sm" variant="outline" disabled={testing === t.id + 'promo' || !!promo}
                          onClick={() => dispatchNow(t.id, 'promo')}>
                          <Send className="w-3.5 h-3.5 mr-1" /> Propaganda
                        </Button>
                        <Button size="sm" variant="outline" disabled={testing === t.id + 'live' || !!live}
                          onClick={() => dispatchNow(t.id, 'live')}>
                          <Radio className="w-3.5 h-3.5 mr-1" /> Ao vivo
                        </Button>
                      </div>
                    );
                  })}
              </div>

            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
