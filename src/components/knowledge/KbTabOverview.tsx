import { useLanguage } from '@/contexts/LanguageContext';

interface Props {
  onGoto: (tab: 'parametros'|'catalogo'|'videos'|'artigos'|'ebooks'|'distribuidores'|'eventos') => void;
}

const CARDS: { key: Props['onGoto'] extends (t: infer T)=>any ? T : never; title: string; desc: string }[] = [
  { key: 'catalogo',       title: 'Catálogo',      desc: 'Resinas, impressoras, scanners e consumíveis.' },
  { key: 'videos',         title: 'Vídeos',        desc: 'Tutoriais, casos clínicos e depoimentos.' },
  { key: 'artigos',        title: 'Artigos',       desc: 'Publicações técnicas e guias práticos.' },
  { key: 'parametros',     title: 'Parâmetros',    desc: 'Parâmetros de impressão por resina e modelo.' },
  { key: 'ebooks',         title: 'Ebooks',        desc: 'Materiais aprofundados para download.' },
  { key: 'eventos',        title: 'Eventos',       desc: 'Cursos, feiras e treinamentos.' },
  { key: 'distribuidores', title: 'Revendas',      desc: 'Rede oficial de revendas Smart Dent.' },
];

export default function KbTabOverview({ onGoto }: Props) {
  const { t } = useLanguage();
  return (
    <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
      {CARDS.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onGoto(c.key)}
          style={{
            textAlign: 'left', background: '#fff', border: '1px solid #E5E7EB',
            borderRadius: 14, padding: 20, cursor: 'pointer', transition: 'transform .15s, box-shadow .15s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(15,23,42,.08)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
        >
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 6px', color: '#0F172A' }}>{c.title}</h3>
          <p style={{ fontSize: 13, color: '#64748B', margin: 0, lineHeight: 1.45 }}>{c.desc}</p>
          <span style={{ display: 'inline-block', marginTop: 12, fontSize: 12, fontWeight: 600, color: '#2563EB' }}>
            Abrir →
          </span>
        </button>
      ))}
    </div>
  );
}