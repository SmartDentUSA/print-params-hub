import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Globe, Instagram, Facebook, Linkedin, Youtube } from 'lucide-react';
import KbSectionHeader from './KbSectionHeader';
import KbSearchBar from './KbSearchBar';
import KbResultCount from './KbResultCount';
import KbEmptyState from './KbEmptyState';
import KbChips, { KbChipOption } from './KbChips';
import { CHIP_KEYS, AuthorizedScope, scopeAllowsCategory, scopeHasAnything } from './kbCategoryTaxonomy';
import { CATALOG_COLORS } from './kbCategoryColors';
import 'flag-icons/css/flag-icons.min.css';

interface Distributor {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  pais: string | null;
  estado: string | null;
  cidade: string | null;
  endereco: string | null;
  cep: string | null;
  numero_unidades: number | null;
  site_url: string | null;
  instagram: string | null;
  facebook: string | null;
  linkedin: string | null;
  youtube: string | null;
  owner_name: string | null;
  owner_email: string | null;
  owner_whatsapp_ddi: string | null;
  owner_whatsapp: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_whatsapp_ddi: string | null;
  buyer_whatsapp: string | null;
  logo_url: string | null;
  authorized_scope: AuthorizedScope | null;
}

function waLink(ddi?: string | null, phone?: string | null) {
  if (!phone) return null;
  const digits = `${ddi || ''}${phone}`.replace(/\D+/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

function ContactBlock({
  label, name, email, ddi, phone,
}: { label: string; name?: string | null; email?: string | null; ddi?: string | null; phone?: string | null }) {
  if (!name && !email && !phone) return null;
  const wa = waLink(ddi, phone);
  return (
    <div style={{ fontSize: 13, lineHeight: 1.45 }}>
      <div style={{ fontWeight: 600, color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</div>
      {name && <div style={{ color: '#0f172a' }}>{name}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 2 }}>
        {email && <a href={`mailto:${email}`} style={{ color: '#2563eb' }}>{email}</a>}
        {wa && <a href={wa} target="_blank" rel="noopener" style={{ color: '#16a34a' }}>WhatsApp</a>}
      </div>
    </div>
  );
}

function SocialIcons({ d }: { d: Distributor }) {
  const links: Array<{ label: string; url: string | null; Icon: any; color: string }> = [
    { label: 'Site',      url: d.site_url,  Icon: Globe,     color: '#0f172a' },
    { label: 'Instagram', url: d.instagram, Icon: Instagram, color: '#E1306C' },
    { label: 'Facebook',  url: d.facebook,  Icon: Facebook,  color: '#1877F2' },
    { label: 'LinkedIn',  url: d.linkedin,  Icon: Linkedin,  color: '#0A66C2' },
    { label: 'YouTube',   url: d.youtube,   Icon: Youtube,   color: '#FF0000' },
  ];
  const visible = links.filter((l) => !!l.url);
  if (!visible.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {visible.map(({ label, url, Icon, color }) => (
        <a
          key={label}
          href={url!}
          target="_blank"
          rel="noopener"
          title={label}
          aria-label={label}
          style={{
            width: 32, height: 32,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 999,
            border: '1px solid #e2e8f0',
            background: '#fff',
            color,
            textDecoration: 'none',
            transition: 'background 0.15s',
          }}
        >
          <Icon size={16} strokeWidth={2} />
        </a>
      ))}
    </div>
  );
}

// Normaliza string removendo acentos para matching robusto
function normalize(str: string) {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

const COUNTRY_TO_ISO: Record<string, string> = {
  brasil: 'BR', brazil: 'BR', br: 'BR',
  chile: 'CL', cl: 'CL',
  argentina: 'AR', ar: 'AR',
  uruguai: 'UY', uruguay: 'UY', uy: 'UY',
  paraguai: 'PY', paraguay: 'PY', py: 'PY',
  bolivia: 'BO', bo: 'BO',
  peru: 'PE', pe: 'PE',
  colombia: 'CO', co: 'CO',
  venezuela: 'VE', ve: 'VE',
  equador: 'EC', ecuador: 'EC', ec: 'EC',
  mexico: 'MX', mx: 'MX',
  'estados unidos': 'US', eua: 'US', usa: 'US', 'united states': 'US', us: 'US',
  portugal: 'PT', pt: 'PT',
  espanha: 'ES', spain: 'ES', es: 'ES',
};

function countryIso(country?: string | null): string | null {
  if (!country) return null;
  const key = normalize(country);
  return COUNTRY_TO_ISO[key] || null;
}

function CountryFlag({ country }: { country?: string | null }) {
  const iso = countryIso(country);
  if (!iso) return null;
  return (
    <span
      className={`fi fi-${iso.toLowerCase()}`}
      title={country || 'País'}
      aria-label={`Bandeira do ${country || 'país'}`}
      style={{ width: 24, height: 18, borderRadius: 2, boxShadow: '0 0 0 1px rgba(15,23,42,0.12)' }}
    />
  );
}

export default function KbTabDistribuidores() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('distributors')
        .select('id,razao_social,nome_fantasia,pais,estado,cidade,endereco,cep,numero_unidades,site_url,instagram,facebook,linkedin,youtube,owner_name,owner_email,owner_whatsapp_ddi,owner_whatsapp,buyer_name,buyer_email,buyer_whatsapp_ddi,buyer_whatsapp,logo_url')
        .eq('active', true)
        .order('nome_fantasia', { ascending: true, nullsFirst: false });
      if (!error && data) setRows(data as Distributor[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r) =>
      [r.nome_fantasia, r.razao_social, r.cidade, r.estado, r.pais]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s))
    );
  }, [rows, q]);

  return (
    <section>
      <KbSectionHeader title={t('kb.distribuidores.title')} subtitle={t('kb.distribuidores.subtitle')} />
      <KbSearchBar placeholder={t('kb.distribuidores.search')} value={q} onDebouncedChange={setQ} />
      {!loading && <KbResultCount count={filtered.length} noun="distributor" />}
      <div className="kb-dgrid">
        {loading ? (
          <div className="kb-skeleton-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="kb-skeleton-card" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <KbEmptyState icon="🏬" />
        ) : (
          filtered.map((d) => {
            const title = d.nome_fantasia || d.razao_social || t('kb.distribuidores.fallback_name');
            const local = [d.cidade, d.estado].filter(Boolean).join(' / ');
            const hasCountryFlag = !!countryIso(d.pais);
            return (
              <div
                key={d.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  {d.logo_url ? (
                    <img
                      src={d.logo_url}
                      alt={title}
                      style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'contain', background: '#f8fafc', border: '1px solid #e2e8f0' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 64, height: 64, borderRadius: 10,
                        background: '#0f172a', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 24,
                      }}
                    >
                      {title.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 16, lineHeight: 1.2 }}>{title}</div>
                    {d.razao_social && d.razao_social !== title && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>{d.razao_social}</div>
                    )}
                  </div>
                </div>

                {(local || d.pais) && (
                  <div style={{ fontSize: 13, color: '#334155', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {hasCountryFlag && <CountryFlag country={d.pais} />}
                    {local && <span>{local}</span>}
                    {!local && !hasCountryFlag && d.pais && <span>{d.pais}</span>}
                  </div>
                )}

                <ContactBlock
                  label="Responsável"
                  name={d.owner_name}
                  email={d.owner_email}
                  ddi={d.owner_whatsapp_ddi}
                  phone={d.owner_whatsapp}
                />
                <ContactBlock
                  label="Compras"
                  name={d.buyer_name}
                  email={d.buyer_email}
                  ddi={d.buyer_whatsapp_ddi}
                  phone={d.buyer_whatsapp}
                />

                <SocialIcons d={d} />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}