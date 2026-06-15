import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

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
  const links: Array<[string, string | null]> = [
    ['Site', d.site_url],
    ['Instagram', d.instagram],
    ['Facebook', d.facebook],
    ['LinkedIn', d.linkedin],
    ['YouTube', d.youtube],
  ];
  const visible = links.filter(([, v]) => !!v);
  if (!visible.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
      {visible.map(([label, url]) => (
        <a
          key={label}
          href={url!}
          target="_blank"
          rel="noopener"
          style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 999,
            border: '1px solid #e2e8f0',
            color: '#475569',
            background: '#f8fafc',
            textDecoration: 'none',
          }}
        >
          {label}
        </a>
      ))}
    </div>
  );
}

export default function KbTabDistribuidores() {
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
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#0f172a' }}>Distribuidores</h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: 13 }}>Rede oficial de distribuidores Smart Dent</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, cidade ou estado"
          style={{
            padding: '8px 12px',
            border: '1px solid #e2e8f0',
            borderRadius: 8,
            background: '#fff',
            minWidth: 260,
            fontSize: 13,
          }}
        />
      </div>

      {loading ? (
        <div style={{ color: '#64748b' }}>Carregando…</div>
      ) : !filtered.length ? (
        <div style={{ color: '#64748b' }}>Nenhum distribuidor cadastrado.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map((d) => {
            const title = d.nome_fantasia || d.razao_social || 'Distribuidor';
            const local = [d.cidade, d.estado].filter(Boolean).join(' / ');
            const pais = d.pais ? ` — ${d.pais}` : '';
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {d.logo_url ? (
                    <img
                      src={d.logo_url}
                      alt={title}
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'contain', background: '#f8fafc', border: '1px solid #e2e8f0' }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48, height: 48, borderRadius: 8,
                        background: '#0f172a', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: 18,
                      }}
                    >
                      {title.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontSize: 15, lineHeight: 1.2 }}>{title}</div>
                    {d.razao_social && d.razao_social !== title && (
                      <div style={{ fontSize: 12, color: '#64748b' }}>{d.razao_social}</div>
                    )}
                  </div>
                </div>

                {(local || pais) && (
                  <div style={{ fontSize: 13, color: '#334155' }}>{local}{pais}</div>
                )}
                {typeof d.numero_unidades === 'number' && d.numero_unidades > 0 && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>Unidades: {d.numero_unidades}</div>
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
          })}
        </div>
      )}
    </div>
  );
}