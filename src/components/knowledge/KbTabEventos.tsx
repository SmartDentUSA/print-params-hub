import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink, MapPin, CalendarDays } from 'lucide-react';
import KbSectionHeader from './KbSectionHeader';
import KbSearchBar from './KbSearchBar';
import KbResultCount from './KbResultCount';
import KbEmptyState from './KbEmptyState';
import { useLanguage } from '@/contexts/LanguageContext';
import { Country } from 'country-state-city';
import 'flag-icons/css/flag-icons.min.css';

interface EventRow {
  id: string;
  name: string;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  company_stand: string | null;
  website_url: string | null;
  cover_image_url: string | null;
  cover_image_pt: string | null;
  cover_image_en: string | null;
  cover_image_es: string | null;
}

const COUNTRY_PT_ALIASES: Record<string, string> = {
  brasil: 'brazil',
  'estados unidos': 'united states',
  eua: 'united states',
  méxico: 'mexico',
  mexico: 'mexico',
  paraguai: 'paraguay',
  uruguai: 'uruguay',
  alemanha: 'germany',
  espanha: 'spain',
  frança: 'france',
  inglaterra: 'united kingdom',
  'reino unido': 'united kingdom',
  itália: 'italy',
  japão: 'japan',
  canadá: 'canada',
  suíça: 'switzerland',
  holanda: 'netherlands',
  'países baixos': 'netherlands',
};

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

function countryIso(name?: string | null): string | null {
  if (!name) return null;
  const key = normalize(name);
  const target = COUNTRY_PT_ALIASES[key] || key;
  const found = Country.getAllCountries().find((c) => c.name.toLowerCase() === target);
  return found?.isoCode || null;
}

function CountryFlag({ country, fallbackLabel, ariaTemplate }: { country?: string | null; fallbackLabel: string; ariaTemplate: string }) {
  const iso = countryIso(country);
  if (!iso) return null;
  return (
    <span
      className={`fi fi-${iso.toLowerCase()}`}
      title={country || fallbackLabel}
      aria-label={ariaTemplate.replace('{{country}}', country || fallbackLabel)}
      style={{ width: 40, height: 30, borderRadius: 4, boxShadow: '0 0 0 1px rgba(15,23,42,0.12)', display: 'inline-block', backgroundSize: 'cover', flexShrink: 0 }}
    />
  );
}

function fmtRange(start: string | null | undefined, end: string | null | undefined, locale: string) {
  if (!start && !end) return null;
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(d + 'T00:00:00').toLocaleDateString(locale, opts);
  if (start && end && start !== end) {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    if (sameMonth) {
      return `${s.getDate()}–${e.getDate()} ${fmt(end, { month: 'short', year: 'numeric' })}`;
    }
    return `${fmt(start, { day: '2-digit', month: 'short' })} → ${fmt(end, { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }
  return fmt((start || end)!, { day: '2-digit', month: 'short', year: 'numeric' });
}

function pickCover(e: EventRow, language: string): string | null {
  if (language === 'en' && e.cover_image_en) return e.cover_image_en;
  if (language === 'es' && e.cover_image_es) return e.cover_image_es;
  if (language === 'pt' && e.cover_image_pt) return e.cover_image_pt;
  return e.cover_image_pt || e.cover_image_url || null;
}

export default function KbTabEventos() {
  const { t, language } = useLanguage();
  const dateLocale = language === 'en' ? 'en-US' : language === 'es' ? 'es-ES' : 'pt-BR';
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('smartops_events')
        .select('id,name,country,start_date,end_date,location,company_stand,website_url,cover_image_url,cover_image_pt,cover_image_en,cover_image_es')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .order('start_date', { ascending: true, nullsFirst: false });
      if (!error && data) setRows(data as EventRow[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.name, r.country, r.location, r.company_stand].filter(Boolean).some((v) => String(v).toLowerCase().includes(s))
    );
  }, [rows, q]);

  return (
    <section>
      {/* Título removido: hero do shell v2 é a única fonte do título nesta aba */}
      <KbSearchBar placeholder={t('kb.eventos.search')} value={q} onDebouncedChange={setQ} />
      {!loading && <KbResultCount count={filtered.length} noun="event" />}
      <div className="kb-dgrid">
        {loading ? (
          <div className="kb-skeleton-grid">
            {Array.from({ length: 6 }).map((_, i) => (<div key={i} className="kb-skeleton-card" />))}
          </div>
        ) : filtered.length === 0 ? (
          <KbEmptyState icon="📅" />
        ) : (
          filtered.map((e) => {
            const dates = fmtRange(e.start_date, e.end_date, dateLocale);
            const cover = pickCover(e, language);
            return (
              <div
                key={e.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                <div style={{ aspectRatio: '16 / 9', background: '#f1f5f9', position: 'relative' }}>
                  {cover ? (
                    <img src={cover} alt={e.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 40 }}>📅</div>
                  )}
                </div>
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 16, lineHeight: 1.3 }}>{e.name}</div>
                  {dates && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1e293b', fontSize: 15, fontWeight: 600 }}>
                      <CalendarDays size={18} /> {dates}
                    </div>
                  )}
                  {(e.location || e.country) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#475569', fontSize: 13, flexWrap: 'wrap' }}>
                      <CountryFlag
                        country={e.country}
                        fallbackLabel={t('kb.eventos.country_label')}
                        ariaTemplate={t('kb.eventos.flag_aria')}
                      />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={14} />
                        {[e.location, e.country].filter(Boolean).join(' — ')}
                      </span>
                    </div>
                  )}
                  {e.company_stand && (
                    <div style={{ fontSize: 12, color: '#0f172a', background: '#e0f2fe', padding: '4px 8px', borderRadius: 6, alignSelf: 'flex-start', fontWeight: 600 }}>
                      {t('kb.eventos.stand')}: {e.company_stand}
                    </div>
                  )}
                  {e.website_url && (
                    <a
                      href={e.website_url}
                      target="_blank"
                      rel="noopener"
                      style={{ marginTop: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, color: '#2563eb', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
                    >
                      {t('kb.eventos.event_site')} <ExternalLink size={13} />
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}