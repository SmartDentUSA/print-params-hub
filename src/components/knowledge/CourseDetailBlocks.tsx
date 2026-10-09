import { useEffect, useMemo, useState } from 'react';
import {
  Award, BookOpen, Briefcase, GraduationCap, Microscope, Sparkles, Star, Users, Timer, CheckCircle2, Flame,
} from 'lucide-react';

/* ---------- Countdown ---------- */
export function CourseCountdown({ date, time }: { date: string | null; time?: string | null }) {
  const target = useMemo(() => {
    if (!date) return null;
    const t = (time ?? '08:00').slice(0, 5);
    const d = new Date(`${date.slice(0, 10)}T${t}:00-03:00`);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }, [date, time]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!target || target <= now) return null;
  const diff = Math.floor((target - now) / 1000);
  const parts = [
    { v: Math.floor(diff / 86400), l: 'dias' },
    { v: Math.floor((diff % 86400) / 3600), l: 'horas' },
    { v: Math.floor((diff % 3600) / 60), l: 'min' },
    { v: diff % 60, l: 'seg' },
  ];
  return (
    <div className="cd-wrap">
      <div className="cd-label"><Timer className="w-3.5 h-3.5" /> Começa em</div>
      <div className="cd-grid">
        {parts.map((p) => (
          <div key={p.l} className="cd-cell">
            <span className="cd-num">{String(p.v).padStart(2, '0')}</span>
            <span className="cd-unit">{p.l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Vagas ---------- */
export function CourseSeats({ total, enrolled }: { total: number | null; enrolled: number | null }) {
  if (!total) return null;
  const used = Math.min(Math.max(enrolled ?? 0, 0), total);
  const left = total - used;
  const pct = Math.round((used / total) * 100);
  const hot = left <= Math.max(3, Math.ceil(total * 0.2));
  return (
    <div className="seats-wrap">
      <div className="seats-head">
        <span className="seats-title"><Users className="w-3.5 h-3.5" /> Vagas</span>
        {hot && left > 0 && <span className="seats-hot"><Flame className="w-3 h-3" /> Últimas vagas</span>}
      </div>
      <div className="seats-nums">
        <div><strong>{left}</strong><span>restantes</span></div>
        <div><strong>{used}</strong><span>preenchidas</span></div>
        <div><strong>{total}</strong><span>total</span></div>
      </div>
      <div className="seats-bar"><div style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

/* ---------- Preço De/Por ---------- */
export function CoursePrice({ price, promo, installments }: { price: number | null; promo: number | null; installments: number | null }) {
  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const hasPrice = typeof price === 'number' && price > 0;
  const hasPromo = typeof promo === 'number' && promo > 0 && (!hasPrice || promo < price!);
  const final = hasPromo ? promo! : hasPrice ? price! : null;
  if (!final) return null;
  const off = hasPromo && hasPrice ? Math.round((1 - promo! / price!) * 100) : 0;
  return (
    <div className="price-wrap">
      {hasPromo && hasPrice && (
        <div className="price-de">De <s>{fmt(price!)}</s>{off > 0 && <span className="price-off">-{off}%</span>}</div>
      )}
      <div className="price-por">
        {hasPromo && hasPrice && <span className="price-por-l">Por</span>}
        <strong>{fmt(final)}</strong>
      </div>
      {installments && installments > 1 ? (
        <div className="price-inst">ou {installments}x de {fmt(final / installments)}</div>
      ) : null}
    </div>
  );
}

/* ---------- Mini CV ---------- */
const CV_RULES: { re: RegExp; icon: any }[] = [
  { re: /doutor|phd|mestr|mestrado|doutorado/i, icon: GraduationCap },
  { re: /especiali|pós|pos-|residên/i, icon: Award },
  { re: /professor|docente|coordenad|instrutor|ensino/i, icon: BookOpen },
  { re: /pesquis|artigo|public|autor|livro/i, icon: Microscope },
  { re: /fundador|sócio|diretor|ceo|clínica|consultório/i, icon: Briefcase },
  { re: /prêmio|premiad|kol|referência|speaker|palestr/i, icon: Star },
];

function splitCv(cv: string): { summary: string | null; items: string[] } {
  const parts = cv
    .replace(/\r/g, '')
    .split(/\n+|•|;|\s[-–]\s|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ])/)
    .map((s) => s.replace(/^[\s\-–•*·]+/, '').replace(/[.;\s]+$/, '').trim())
    .filter((s) => s.length > 2)
    // Descarta títulos soltos sem conteúdo ("Prof", "Dr", "MsC" etc.)
    .filter((s) => !(s.length < 25 && /^(prof|dr|dra|msc|phd|especialista|mestre|doutor)(a)?\.?$/i.test(s)));
  const seen = new Set<string>();
  const uniq = parts.filter((p) => { const k = p.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
  if (uniq.length <= 1) return { summary: uniq[0] ?? null, items: [] };
  // Resumo: primeira frase sem cara de título acadêmico curto
  const summary = uniq.find((p) => p.length > 60 && !CV_RULES.some((r) => r.re.test(p))) ?? null;
  const items = uniq.filter((p) => p !== summary).slice(0, 6);
  return { summary, items };
}

export function MiniCv({ cv }: { cv: string }) {
  const { summary, items } = useMemo(() => splitCv(cv), [cv]);
  return (
    <div className="cv-wrap">
      {summary && <p className="cv-summary">{summary}</p>}
      {items.length > 0 && (
        <ul className="cv-list">
          {items.map((it, i) => {
            const Icon = CV_RULES.find((r) => r.re.test(it))?.icon ?? CheckCircle2;
            return (
              <li key={i}><span className="cv-ic"><Icon className="w-3.5 h-3.5" /></span><span>{it}</span></li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- Cronograma ---------- */
type Block = { heading: string | null; lines: string[] };
function groupItems(items: string[]): { intro: string[]; blocks: Block[] } {
  const intro: string[] = [];
  const blocks: Block[] = [];
  for (const raw of items) {
    const it = String(raw ?? '').trim();
    if (!it) continue;
    const m = it.match(/^([A-Z])\.\s+(.*)$/);
    if (m) blocks.push({ heading: `${m[1]}|${m[2]}`, lines: [] });
    else if (blocks.length) blocks[blocks.length - 1].lines.push(it);
    else intro.push(it);
  }
  return { intro, blocks };
}

export function SyllabusPremium({ modules }: { modules: { title?: string | null; items?: string[] | null }[] }) {
  return (
    <div className="sy-list">
      {modules.map((mod, i) => {
        const { intro, blocks } = groupItems(Array.isArray(mod?.items) ? mod.items : []);
        const [dayLabel, dateLabel] = String(mod?.title ?? '').split(/\s+[—–-]\s+/);
        return (
          <article key={i} className="sy-day">
            <header className="sy-day-head">
              <span className="sy-num">{String(i + 1).padStart(2, '0')}</span>
              <div>
                <div className="sy-day-title">{dayLabel || `Módulo ${i + 1}`}</div>
                {dateLabel && <div className="sy-day-date">{dateLabel}</div>}
              </div>
            </header>
            {intro.map((t, k) => (
              /^resultado esperado/i.test(t)
                ? <div key={k} className="sy-result"><Sparkles className="w-4 h-4" /><span>{t}</span></div>
                : <p key={k} className="sy-intro">{t}</p>
            ))}
            <div className="sy-blocks">
              {blocks.map((b, k) => {
                const [letter, title] = b.heading!.split('|');
                const result = b.lines.filter((l) => /^resultado esperado/i.test(l));
                const rest = b.lines.filter((l) => !/^resultado esperado/i.test(l));
                return (
                  <div key={k}>
                    <div className="sy-block">
                      <span className="sy-letter">{letter}</span>
                      <div className="min-w-0">
                        <div className="sy-block-title">{title}</div>
                        {rest.map((l, x) => <p key={x} className="sy-block-text">{l}</p>)}
                      </div>
                    </div>
                    {result.map((r, x) => (
                      <div key={x} className="sy-result"><Sparkles className="w-4 h-4" /><span>{r}</span></div>
                    ))}
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}
