// live-group-blast-cron — divulgação automática de lives em grupos WA.
// 1) Propaganda: D-N às HH:MM (default D-1 08:30 SP)
// 2) Lembrete "estamos ao vivo": N minutos antes do início (default 5)
// Ambos com o thumb do YouTube da live (live_thumbnail_url).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { spDateTimeToUtc, addDaysSp } from '../_shared/timezone.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUBLIC_ORIGIN = 'https://parametros.smartdent.com.br';

const DEFAULT_PROMO = `🔴 *AMANHÃ TEM LIVE* — {{titulo}}

📅 {{data}} às {{hora}} (horário de Brasília)
🎥 Transmissão ao vivo no YouTube
🎓 Com {{instrutor}}

👉 Garanta sua vaga: {{inscricao}}`;

const DEFAULT_LIVE = `🔴 *ESTAMOS AO VIVO EM 5 MINUTOS!*

{{titulo}}

▶️ Entre agora: {{live_url}}`;

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
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
function fmtTime(t: string | null): string {
  if (!t) return '';
  return t.slice(0, 5);
}
function render(tpl: string, ctx: Record<string, string>): string {
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => ctx[k] ?? '');
}

async function shorten(sb: any, url: string, produto: string): Promise<string> {
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/short-link-create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ url, produto }),
    });
    const j = await r.json().catch(() => ({}));
    const short = j?.short_url ?? j?.url ?? null;
    return typeof short === 'string' && short.length > 0 ? short : url;
  } catch {
    return url;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  let body: any = {};
  try { body = req.method === 'POST' ? await req.json() : {}; } catch { /* noop */ }
  const dryRun = body?.dry_run === true;
  const forceTurmaId: string | null = typeof body?.turma_id === 'string' ? body.turma_id : null;
  const forceKind: 'promo' | 'live' | null = body?.kind === 'promo' || body?.kind === 'live' ? body.kind : null;

  const { data: autos } = await sb.from('live_group_automations').select('*');
  const automations = ((autos ?? []) as Automation[]).filter((a) => a.enabled || forceTurmaId);
  if (automations.length === 0) {
    return Response.json({ ok: true, reason: 'no_active_automations', sent: 0 }, { headers: corsHeaders });
  }

  // Lives futuras (janela de 3 dias) com URL do YouTube
  const todayIso = new Date(Date.now() - 12 * 3600_000).toISOString().slice(0, 10);
  let q = sb
    .from('smartops_course_turmas')
    .select('id, course_id, label, turma_number, start_date, live_url, live_thumbnail_url, active, smartops_courses(id, title, slug, cover_image_url, instructor_name, category, modality)')
    .eq('active', true)
    .gte('start_date', todayIso)
    .lte('start_date', new Date(Date.now() + 5 * 86400_000).toISOString().slice(0, 10));
  if (forceTurmaId) q = sb
    .from('smartops_course_turmas')
    .select('id, course_id, label, turma_number, start_date, live_url, live_thumbnail_url, active, smartops_courses(id, title, slug, cover_image_url, instructor_name, category, modality)')
    .eq('id', forceTurmaId);
  const { data: turmas } = await q;

  const turmaIds = (turmas ?? []).map((t: any) => t.id);
  const { data: days } = turmaIds.length
    ? await sb.from('smartops_turma_days').select('turma_id, date, start_time, day_number').in('turma_id', turmaIds).order('day_number')
    : { data: [] as any[] } as any;
  const firstDay = new Map<string, { date: string; start_time: string }>();
  for (const d of (days ?? []) as any[]) {
    if (!firstDay.has(d.turma_id)) firstDay.set(d.turma_id, { date: d.date, start_time: d.start_time });
  }

  const { data: logs } = await sb.from('live_group_blast_log').select('automation_id, turma_id, kind');
  const alreadySent = new Set(((logs ?? []) as any[]).map((l) => `${l.automation_id}|${l.turma_id}|${l.kind}`));

  const now = Date.now();
  const results: any[] = [];

  for (const auto of automations) {
    if (!auto.group_ids?.length) continue;
    const { data: groups } = await sb
      .from('wa_groups')
      .select('id, group_jid, name, is_admin, enabled')
      .in('id', auto.group_ids);
    const jids = ((groups ?? []) as any[]).filter((g) => g.is_admin && g.enabled && g.group_jid).map((g) => g.group_jid);
    if (jids.length === 0) { results.push({ automation: auto.id, skipped: 'no_eligible_groups' }); continue; }

    for (const t of (turmas ?? []) as any[]) {
      const course = t.smartops_courses ?? {};
      if (auto.course_ids?.length && !auto.course_ids.includes(t.course_id)) continue;
      if (!t.live_url && !forceTurmaId) continue;

      const fd = firstDay.get(t.id);
      const dateIso: string | null = fd?.date ?? t.start_date ?? null;
      if (!dateIso) continue;
      const startTime = fmtTime(fd?.start_time ?? null) || '19:00';
      const [sh, sm] = startTime.split(':').map(Number);
      const dayRef = new Date(`${dateIso}T12:00:00Z`);
      const startUtc = spDateTimeToUtc(dayRef, sh, sm).getTime();

      const inscricao = course.slug
        ? await shorten(sb, `${PUBLIC_ORIGIN}/inscricao/${course.slug}`, `live-${course.slug}`)
        : (t.live_url ?? '');
      const ctx: Record<string, string> = {
        titulo: String(course.title ?? t.label ?? 'Live Smart Dent'),
        turma: t.turma_number ? `#${t.turma_number}` : '',
        data: fmtDate(dateIso),
        hora: startTime,
        instrutor: String(course.instructor_name ?? 'Smart Dent'),
        live_url: String(t.live_url ?? ''),
        inscricao,
      };
      const media = t.live_thumbnail_url || course.cover_image_url || null;

      const jobs: { kind: 'promo' | 'live'; due: number; windowMs: number; text: string }[] = [];

      if (auto.promo_enabled) {
        const [ph, pm] = fmtTime(auto.promo_time).split(':').map(Number);
        const promoDay = addDaysSp(dayRef, -Math.max(0, auto.promo_days_before ?? 1));
        const promoDue = spDateTimeToUtc(promoDay, ph || 8, pm || 30).getTime();
        jobs.push({
          kind: 'promo',
          due: promoDue,
          windowMs: 6 * 3600_000,
          text: render(auto.promo_template || DEFAULT_PROMO, ctx),
        });
      }
      if (auto.live_enabled) {
        jobs.push({
          kind: 'live',
          due: startUtc - Math.max(1, auto.live_minutes_before ?? 5) * 60_000,
          windowMs: 20 * 60_000,
          text: render(auto.live_template || DEFAULT_LIVE, ctx),
        });
      }

      for (const job of jobs) {
        if (forceKind && job.kind !== forceKind) continue;
        const key = `${auto.id}|${t.id}|${job.kind}`;
        if (alreadySent.has(key)) continue;
        const forced = !!forceTurmaId;
        if (!forced && (now < job.due || now > job.due + job.windowMs)) continue;

        if (dryRun) {
          results.push({ automation: auto.id, turma: t.id, kind: job.kind, dry_run: true, groups: jids.length, text: job.text, media });
          continue;
        }

        const resp = await fetch(`${SUPABASE_URL}/functions/v1/wa-group-blast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
          body: JSON.stringify({
            group_jids: jids,
            message_type: media ? 'image' : 'msg',
            content: media ? { media_url: media, caption: job.text } : { text: job.text },
            allow_duplicate: true,
            campaign_name: `Live ${job.kind === 'promo' ? 'D-' + (auto.promo_days_before ?? 1) : 'AO VIVO'} | ${ctx.titulo.slice(0, 40)} | ${String(t.id).slice(0, 8)}`,
          }),
        });
        const json = await resp.json().catch(() => ({}));
        const ok = resp.ok && json?.ok;
        if (ok) {
          await sb.from('live_group_blast_log').insert({
            automation_id: auto.id,
            turma_id: t.id,
            kind: job.kind,
            campaign_id: json?.campaign_id ?? null,
            groups_count: json?.groups ?? jids.length,
          });
          alreadySent.add(key);
        } else {
          console.warn('[live-group-blast-cron] blast fail', job.kind, t.id, resp.status, json?.error ?? json?.message);
        }
        results.push({ automation: auto.id, turma: t.id, kind: job.kind, ok, groups: json?.groups ?? 0, error: ok ? null : (json?.error ?? json?.message ?? null) });
      }
    }
  }

  return Response.json({ ok: true, sent: results.filter((r) => r.ok).length, results }, { headers: corsHeaders });
});
