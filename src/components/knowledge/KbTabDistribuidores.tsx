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
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
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
      style={{ width: 40, height: 30, borderRadius: 4, boxShadow: '0 0 0 1px rgba(15,23,42,0.12)', display: 'inline-block', backgroundSize: 'cover' }}
    />
  );
}

export default function KbTabDistribuidores() {
  const { t } = useLanguage();
  const [rows, setRows] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [chip, setChip] = useState('all');
  const [country, setCountry] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('distributors')
        .select('id,razao_social,nome_fantasia,pais,estado,cidade,endereco,cep,numero_unidades,site_url,instagram,facebook,linkedin,youtube,owner_name,owner_email,owner_whatsapp_ddi,owner_whatsapp,buyer_name,buyer_email,buyer_whatsapp_ddi,buyer_whatsapp,logo_url,authorized_scope')
        .eq('active', true)
        .order('nome_fantasia', { ascending: true, nullsFirst: false });
      if (!error && data) setRows(data as Distributor[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (chip !== 'all' && !scopeAllowsCategory(r.authorized_scope, chip)) return false;
      if (country !== 'all' && normalize(r.pais || '') !== normalize(country)) return false;
      if (!s) return true;
      return [r.nome_fantasia, r.razao_social, r.cidade, r.estado, r.pais]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s));
    });
  }, [rows, q, chip, country]);

  const availableCountries = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.pais && countryIso(r.pais)) set.add(r.pais.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [rows]);

  // Apenas exibe chips de categorias que têm ao menos um distribuidor autorizado
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (!scopeHasAnything(r.authorized_scope)) return;
      Object.keys(r.authorized_scope || {}).forEach((cat) => set.add(cat));
    });
    return set;
  }, [rows]);

  const countryChips: KbChipOption[] = useMemo(() => {
    const list: KbChipOption[] = [{ key: 'all', label: 'Todos' }];
    availableCountries.forEach((c) => list.push({ key: c, label: c }));
    return list;
  }, [availableCountries]);

  const chips: KbChipOption[] = CHIP_KEYS
    .filter((c) => c.key === 'all' || availableCategories.has(c.key))
    .map((c) => ({ key: c.key, label: t(c.tk) }));

  // Se a categoria selecionada deixou de ter distribuidores, volta para "all"
  useEffect(() => {
    if (chip !== 'all' && !availableCategories.has(chip)) setChip('all');
  }, [chip, availableCategories]);

  return (
    <section>
      <KbSectionHeader title={t('kb.distribuidores.title')} subtitle={t('kb.distribuidores.subtitle')} />
      <KbSearchBar placeholder={t('kb.distribuidores.search')} value={q} onDebouncedChange={setQ} />
      {availableCountries.length > 1 && (
        <div style={{ margin: '8px 0 12px', maxWidth: 280 }}>
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger>
              <SelectValue placeholder="Filtrar por país" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os países</SelectItem>
              {availableCountries.map((c) => (
                <SelectItem key={c} value={c}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <CountryFlag country={c} />
                    {c}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <KbChips options={chips} active={chip} onChange={setChip} />
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
            const hasCountryFlag = !!countryIso(d.pais);
            return (
              <div
                key={d.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 20,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 16,
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
                }}
              >
                {d.logo_url ? (
                  <img
                    src={d.logo_url}
                    alt={title}
                    style={{ width: 96, height: 96, borderRadius: 14, objectFit: 'contain', background: '#f8fafc', border: '1px solid #e2e8f0', flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{
                      width: 96, height: 96, borderRadius: 14,
                      background: '#0f172a', color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 700, fontSize: 32, flexShrink: 0,
                    }}
                  >
                    {title.charAt(0).toUpperCase()}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 16, lineHeight: 1.25 }}>{title}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginLeft: 0, paddingLeft: 0 }}>
                    {hasCountryFlag && <CountryFlag country={d.pais} />}
                    <SocialIcons d={d} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}