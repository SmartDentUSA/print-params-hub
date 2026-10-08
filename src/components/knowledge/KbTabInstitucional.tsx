import { institutionalCopy as C } from '@/content/institutional';
import { isInstitutionalHost } from '@/utils/institutionalHost';
import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, MessageCircle, ShieldCheck, GraduationCap, Printer, ScanLine, Layers, Sparkles, Beaker, ChevronDown, MapPin, Building2, FlaskConical, Award, Globe2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import heroImg from '@/assets/institucional-hero-produtos.jpg';
import logoFda from '@/assets/logo-fda.png';
import logoIso from '@/assets/logo-iso.png';
import logoUnc from '@/assets/logo-unc.png';
import logoUsp from '@/assets/logo-usp.png';
import resinasLinha from '@/assets/resinas-linha.png.asset.json';

const VIDEO_ID = 'HyGSOn6gIsw';
const VIDEO_THUMB = `https://i.ytimg.com/vi/${VIDEO_ID}/maxresdefault.jpg`;
const VIDEO_TITLE = 'Descubra o poder do Chair Side com resina Vitality';
const LOGOS = [logoFda, logoIso, logoUnc, logoUsp];
const LOGO_DIM: Array<[number, number]> = [[900, 188], [900, 324], [900, 387], [900, 366]];

type Lang = 'pt' | 'en' | 'es';
const SITE = typeof window !== 'undefined' && isInstitutionalHost(window.location.hostname)
  ? 'https://www.smartdent.com.br' : 'https://parametros.smartdent.com.br';
const STORE = 'https://loja.smartdent.com.br';
const IMG = 'https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/landing-page-images/';
const WA_SALES = 'https://api.whatsapp.com/send?phone=5516993831794&text=';
const WA_SUPPORT = 'https://api.whatsapp.com/send/?phone=551634194735&text=';

const PATHS: Record<Lang, { kb: string; home: string }> = {
  pt: { kb: '/base-conhecimento', home: SITE === 'https://www.smartdent.com.br' ? '/' : '/institucional' },
  en: { kb: '/en/knowledge-base', home: '/en/institutional' },
  es: { kb: '/es/base-conocimiento', home: '/es/institucional' },
};


const SOL_ICONS = [Beaker, Layers, ScanLine, Printer, Sparkles, FlaskConical];
// Imagens reais de produtos do catálogo (buckets oficiais do Sistema A/B).
const CAT_IMG = 'https://okeogjgqijbfkudfjadz.supabase.co/storage/v1/object/public/catalog-images/products';
const PROD_IMG = 'https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/product-images/products';
const SOL_IMGS = [
  resinasLinha.url,
  `${PROD_IMG}/9ca9fd62-7282-409f-b633-d9f25ea2cb5d-1770349119603.webp`,
  `${CAT_IMG}/scanner-intraoral-medit-i600-2.png`,
  `${PROD_IMG}/c3f880d0-3841-4bda-8f62-757594eff6dd-1764283866699.webp`,
  `${PROD_IMG}/18206007-3dbb-4f06-9f6c-8f2d49503152-1764283862887.webp`,
  `${CAT_IMG}/nanoclean-pod-limpeza-resina-3d-odontologica-sem-alcool-1784902807481.png`,
];
// Categoria correspondente no catálogo da Base de Conhecimento (chaves de catalogSidebarFilters).
const SOL_CATS = ['resinas_3d', 'softwares_cad', 'scanners', 'impressoras_3d', 'pos_impressao', 'cimentos'];

const css = `
.sdi{--ink:#2f3650;--ink2:#ffffff;--line:rgba(47,54,80,.12);--txt:#2f3650;--mut:#5d6782;--cy:#2f3650;--or:#e5703a;
  font-family:'Manrope','Sora',system-ui,sans-serif;color:var(--txt);overflow:hidden;margin:0;position:relative;isolation:isolate;
  background:radial-gradient(120% 70% at 80% 0%,#ffffff 0%,transparent 60%),linear-gradient(180deg,#dfe6ef 0%,#eef2f7 45%,#e4eaf2 100%)}
.sdi *{box-sizing:border-box}
.sdi a{color:inherit;text-decoration:none}
.sdi-wrap{max-width:none;margin:0;padding:0 clamp(24px,5vw,80px)}
.sdi-hero{position:relative;min-height:660px;display:flex;align-items:center;padding:88px 0 96px;overflow:hidden;background:#26344a;isolation:isolate}
.sdi-hero-bg{position:absolute;inset:0;z-index:0;background-color:#26344a;background-repeat:no-repeat;background-position:center;background-size:cover;overflow:hidden}
.sdi-hero-bg iframe{position:absolute;top:50%;left:50%;width:max(100vw,177.78vh);height:max(56.25vw,100vh);transform:translate(-50%,-50%);border:0;pointer-events:none}
.sdi-hero-bg:after{content:"";position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,rgba(22,35,52,.9) 0%,rgba(25,43,62,.72) 42%,rgba(31,71,91,.3) 72%,rgba(31,71,91,.42) 100%)}
.sdi-hero>.sdi-wrap{position:relative;z-index:2}
.sdi-grid-fx{display:none}
.sdi-eyebrow{display:inline-flex;gap:10px;align-items:center;font-size:11.5px;letter-spacing:.28em;text-transform:uppercase;color:rgba(255,255,255,.78)}
.sdi-eyebrow i{width:28px;height:2px;background:var(--or)}
.sdi h1{color:#fff!important;-webkit-text-fill-color:currentColor;background:none;font-size:clamp(34px,3.9vw,62px);line-height:1.02;letter-spacing:-.04em;font-weight:300;margin:22px 0 22px;max-width:640px;text-shadow:0 2px 24px rgba(0,0,0,.22)}
.sdi h1 em{font-style:normal;font-weight:800;display:block;-webkit-text-fill-color:currentColor;color:#fff}
.sdi-hero .sdi-wrap>*{max-width:min(560px,52%)}.sdi-lead{font-size:clamp(16px,1.3vw,19px);line-height:1.6;color:rgba(255,255,255,.9);max-width:560px}
.sdi-tldr{margin-top:22px;max-width:560px;font-size:13px;line-height:1.6;color:rgba(255,255,255,.76);border-left:2px solid var(--or);padding:2px 0 2px 14px}
.sdi-ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}
.sdi-btn{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 26px;border-radius:14px;font-weight:600;font-size:15px;transition:transform .25s,box-shadow .25s,background .25s}
.sdi-btn:hover{transform:translateY(-2px)}
.sdi-btn.pri{background:#fff;color:var(--ink);box-shadow:0 14px 34px -14px rgba(0,0,0,.6)}
.sdi-btn.gho{border:1px solid rgba(255,255,255,.9);background:rgba(255,255,255,.55);backdrop-filter:blur(10px);color:var(--txt)}
.sdi-btn.gho:hover{background:rgba(255,255,255,.85)}
.sdi-glass{background:rgba(255,255,255,.55);border:1px solid rgba(255,255,255,.95);backdrop-filter:blur(16px);box-shadow:0 20px 50px -30px rgba(47,54,80,.35)}
.sdi-logos{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-top:34px}

.sdi-logo{border-radius:18px;background:rgba(255,255,255,.62);border:1px solid #fff;backdrop-filter:blur(14px);padding:22px 16px 18px;display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;box-shadow:0 14px 34px -26px rgba(47,54,80,.35)}
.sdi-logo img{max-height:46px;max-width:72%;object-fit:contain}
.sdi-logo b{font-size:14px;font-weight:800;letter-spacing:.04em}
.sdi-logo span{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut)}
.sdi-video{position:relative;max-width:980px;aspect-ratio:16/9;border-radius:24px;overflow:hidden;box-shadow:0 30px 70px -35px rgba(47,54,80,.55);background:#2f3650}
.sdi-video iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.sdi-video-facade{all:unset;cursor:pointer;position:absolute;inset:0;display:block}
.sdi-video-facade img{width:100%;height:100%;object-fit:cover;display:block}
.sdi-play{position:absolute;inset:0;margin:auto;width:76px;height:76px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.92);color:var(--or);box-shadow:0 18px 40px -12px rgba(47,54,80,.6);transition:transform .25s}
.sdi-video-facade:hover .sdi-play{transform:scale(1.08)}
.sdi-sec{padding:96px 0 0}
.sdi-h2{color:var(--txt);font-size:clamp(28px,3.4vw,46px);letter-spacing:-.035em;line-height:1.05;margin:0 0 12px;font-weight:300}
.sdi-h2 b,.sdi-h2 strong{font-weight:800}
.sdi-sub{color:var(--mut);font-size:16px;max-width:560px;margin:0 0 40px}
.sdi-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
.sdi-card{position:relative;border-radius:24px;overflow:hidden;background:rgba(255,255,255,.62);border:1px solid #fff;backdrop-filter:blur(14px);display:flex;flex-direction:column;transition:transform .35s,box-shadow .35s;box-shadow:0 18px 44px -30px rgba(47,54,80,.35)}
.sdi-card:hover{transform:translateY(-6px);box-shadow:0 30px 60px -30px rgba(47,54,80,.5)}
.sdi-card-img{height:220px;background:radial-gradient(60% 60% at 50% 70%,#ffffff 0%,#e9eef5 70%) ;background-repeat:no-repeat;background-position:center;background-size:auto 78%;transition:transform .6s;position:relative}
.sdi-card-img:after{content:"";position:absolute;left:22%;right:22%;bottom:14px;height:14px;border-radius:50%;background:rgba(47,54,80,.12);filter:blur(8px);z-index:-1}
.sdi-card:hover .sdi-card-img{transform:scale(1.04)}
.sdi-card-b{padding:22px 24px 24px;display:flex;flex-direction:column;gap:8px;flex:1}
.sdi-card-ic{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:#fff;color:var(--or);box-shadow:0 6px 16px -8px rgba(47,54,80,.4)}
.sdi-card h3{font-size:18px;font-weight:700;margin:6px 0 0;letter-spacing:-.01em}.sdi-card p{margin:0;color:var(--mut);font-size:14px;line-height:1.55;flex:1}
.sdi-card-a{display:flex;gap:16px;margin-top:12px;font-size:13.5px;font-weight:700}
.sdi-card-a a{display:inline-flex;align-items:center;gap:6px;color:var(--or)}.sdi-card-a a+a{color:var(--txt)}
.sdi-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:0;counter-reset:s;border-radius:22px;background:rgba(255,255,255,.55);border:1px solid #fff;backdrop-filter:blur(14px)}
.sdi-step{padding:30px 26px;border-left:1px solid var(--line);position:relative}.sdi-step:first-child{border:0}
.sdi-step:before{counter-increment:s;content:"0" counter(s);font-size:13px;font-weight:800;letter-spacing:.2em;color:var(--or);display:block;margin-bottom:14px}
.sdi-step h3{margin:0 0 6px;font-size:16px;font-weight:700}.sdi-step p{margin:0;color:var(--mut);font-size:14px;line-height:1.55}
.sdi-bento{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:20px}
.sdi-panel-a{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.sdi-panel-a a{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:600;padding:9px 14px;border-radius:999px;background:#fff;color:var(--ink);box-shadow:0 8px 20px -14px rgba(47,54,80,.5)}
.sdi-panel-a a.or{background:var(--or);color:#fff}
.sdi-panel{border-radius:24px;padding:38px;background:rgba(255,255,255,.62);border:1px solid #fff;backdrop-filter:blur(14px);box-shadow:0 18px 44px -30px rgba(47,54,80,.35)}
.sdi-panel svg{color:var(--or)}
.sdi-panel h3{font-size:24px;font-weight:700;margin:14px 0 12px;letter-spacing:-.02em}.sdi-panel p{color:var(--mut);line-height:1.7;margin:0;font-size:15px}
.sdi-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.sdi-badges span{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;padding:7px 12px;border-radius:999px;background:#fff;color:var(--txt)}
.sdi-band{margin-top:96px;border-radius:26px;padding:48px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;background:linear-gradient(120deg,#2f3650,#454e6e);color:#fff;position:relative;overflow:hidden}
.sdi-band:after{content:"";position:absolute;right:-80px;top:-80px;width:280px;height:280px;border-radius:50%;background:radial-gradient(circle,rgba(229,112,58,.45),transparent 70%)}
.sdi-band h2{margin:0;font-size:clamp(24px,2.6vw,36px);font-weight:300;letter-spacing:-.02em;color:#fff}.sdi-band p{margin:6px 0 0;color:rgba(255,255,255,.75)}
.sdi-band .sdi-btn.pri{background:#fff;color:var(--ink);position:relative;z-index:1}
.sdi-faq{max-width:none}
.sdi-q{border-bottom:1px solid var(--line)}
.sdi-q button{all:unset;cursor:pointer;display:flex;justify-content:space-between;gap:16px;width:100%;padding:22px 0;font-size:17px;font-weight:600;color:var(--txt)}
.sdi-q svg{transition:transform .3s;flex:none;color:var(--or)}.sdi-q.on svg{transform:rotate(180deg)}
.sdi-q div{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s}.sdi-q.on div{grid-template-rows:1fr}
.sdi-q p{overflow:hidden;margin:0;color:var(--mut);line-height:1.7}.sdi-q.on p{padding-bottom:22px}
.sdi-final{margin:96px 0 0;padding:84px 0;text-align:center;background:linear-gradient(180deg,transparent,rgba(255,255,255,.7));border-top:1px solid rgba(255,255,255,.9)}
.sdi-final p{color:var(--mut);max-width:600px;margin:0 auto 28px;line-height:1.7}
.sdi-final .sdi-ctas{justify-content:center}
.sdi-links{display:flex;justify-content:center;gap:22px;flex-wrap:wrap;margin-top:32px;font-size:11.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--mut)}.sdi-links a:hover{color:var(--or)}
.sdi-rv{animation:sdiUp .8s cubic-bezier(.2,.7,.2,1) both}.sdi-rv.d1{animation-delay:.1s}.sdi-rv.d2{animation-delay:.2s}.sdi-rv.d3{animation-delay:.3s}
@keyframes sdiUp{from{opacity:0;transform:translateY(18px)}}
@media(prefers-reduced-motion:reduce){.sdi *{animation:none!important;transition:none!important}}
@media(max-width:960px){.sdi-hero .sdi-wrap>*{max-width:100%!important}.sdi-cards{grid-template-columns:repeat(2,1fr)}.sdi-steps{grid-template-columns:repeat(2,1fr)}.sdi-step:nth-child(3){border-left:0}.sdi-bento{grid-template-columns:1fr}.sdi-hero-bg:after{background:rgba(22,35,52,.74)}.sdi-logos{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.sdi-cards,.sdi-steps{grid-template-columns:1fr}.sdi-step{border-left:0!important}.sdi-hero{min-height:560px;padding-top:64px}.sdi-panel,.sdi-band{padding:26px}.sdi-logos{gap:10px}.sdi-logo{padding:16px 12px 14px}.sdi-logo img{max-height:36px}}
`;

export default function KbTabInstitucional() {
  const { language } = useLanguage();
  const lang: Lang = (['pt', 'en', 'es'].includes(language) ? language : 'pt') as Lang;
  const c = C[lang];
  const [open, setOpen] = useState<number | null>(0);
  const p = PATHS[lang];
  const wa = WA_SALES + encodeURIComponent(c.waSales);
  const url = SITE + p.home;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization', '@id': `${SITE}/#org`, name: 'Smart Dent | Fluxo Digital', legalName: 'MMTech Projetos Tecnológicos Importação e Exportação Ltda.',
        url: SITE, foundingDate: '2009', logo: `${IMG}db0bvt68v7b_1775012462717.png`,
        founder: [{ '@type': 'Person', name: 'Marcelo Del Guerra', alumniOf: 'EESC-USP' }, { '@type': 'Person', name: 'Marcelo Cestari', alumniOf: 'EESC-USP' }],
        address: { '@type': 'PostalAddress', addressLocality: 'São Carlos', addressRegion: 'SP', addressCountry: 'BR' },
        subOrganization: { '@type': 'Organization', name: 'MMTech North America LLC', foundingDate: '2022', address: { '@type': 'PostalAddress', streetAddress: '10800 Sikes Place', addressLocality: 'Charlotte', addressRegion: 'NC', addressCountry: 'US' } },
        memberOf: { '@type': 'CollegeOrUniversity', name: 'University of North Carolina at Charlotte' },
        identifier: { '@type': 'PropertyValue', propertyID: 'FDA Establishment Number', value: '3027526455' },
        knowsAbout: ['Odontologia digital', 'Impressão 3D odontológica', 'Resinas 3D biocompatíveis', 'Escaneamento intraoral', 'CAD/CAM', 'ChairSide Print'],
        sameAs: [STORE, 'https://www.instagram.com/smartdent'],
        contactPoint: [{ '@type': 'ContactPoint', telephone: '+55-16-99383-1794', contactType: 'sales', availableLanguage: ['pt', 'en', 'es'] }, { '@type': 'ContactPoint', telephone: '+55-16-3419-4735', contactType: 'technical support' }],
      },
      {
        '@type': 'WebPage', '@id': `${url}#page`, url, name: c.seoTitle, description: c.seoDesc, inLanguage: lang === 'pt' ? 'pt-BR' : lang,
        about: { '@id': `${SITE}/#org` }, speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.sdi h1', '.sdi-tldr'] },
      },
      {
        '@type': 'ItemList', name: c.solTitle,
        itemListElement: c.sol.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s[0], url: `${SITE}${p.kb}?tab=catalogo&cat=${SOL_CATS[i]}` })),
      },
      {
        '@type': 'VideoObject', '@id': `${url}#video`, name: VIDEO_TITLE, description: c.videoSub,
        thumbnailUrl: [VIDEO_THUMB], embedUrl: `https://www.youtube-nocookie.com/embed/${VIDEO_ID}`,
        contentUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
        publisher: { '@id': `${SITE}/#org` },
      },
    ],
  };

  return (
    <article className="sdi" lang={lang === 'pt' ? 'pt-BR' : lang} itemScope itemType="https://schema.org/WebPage">
      <Helmet>
        <title>{c.seoTitle}</title>
        <meta name="description" content={c.seoDesc} />
        <link rel="canonical" href={url} />
        <link rel="alternate" hrefLang="pt-BR" href={SITE + PATHS.pt.home} />
        <link rel="alternate" hrefLang="en" href={SITE + PATHS.en.home} />
        <link rel="alternate" hrefLang="es" href={SITE + PATHS.es.home} />
        <link rel="alternate" hrefLang="x-default" href={SITE + PATHS.pt.home} />
        <meta property="og:title" content={c.seoTitle} />
        <meta property="og:description" content={c.seoDesc} />
        <meta property="og:url" content={url} />
        <meta property="og:type" content="website" />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      <style>{css}</style>

      <header className="sdi-hero">
        <div className="sdi-hero-bg" style={{ backgroundImage: `url(${heroImg})` }} aria-hidden>
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${VIDEO_ID}?autoplay=1&mute=1&loop=1&playlist=${VIDEO_ID}&controls=0&rel=0&playsinline=1&disablekb=1`}
            title=""
            tabIndex={-1}
            allow="autoplay; encrypted-media"
          />
        </div>
        <div className="sdi-grid-fx" aria-hidden />
        <div className="sdi-wrap" style={{ width: '100%' }}>
          <span className="sdi-eyebrow sdi-rv"><i />{c.eyebrow}</span>
          <h1 className="sdi-rv d1" itemProp="name">{c.h1a} <em>{c.h1b}</em> {c.h1c}</h1>
          <p className="sdi-lead sdi-rv d2" itemProp="description">{c.lead}</p>
          <p className="sdi-tldr sdi-rv d2">{c.tldr}</p>
          <div className="sdi-ctas sdi-rv d3">
            <a className="sdi-btn pri" href={wa} target="_blank" rel="noopener"><MessageCircle size={18} />{c.ctaTalk}</a>
            <a className="sdi-btn gho" href={STORE} target="_blank" rel="noopener">{c.ctaStore}<ArrowRight size={16} /></a>
            <a className="sdi-btn gho" href={`${p.kb}?tab=parametros`}>{c.ctaParams}</a>
          </div>
        </div>
      </header>

        <div className="sdi-wrap">


        <div className="sdi-logos">
          {c.logos.map(([t, s], i) => (
            <div className="sdi-logo" key={t}>
              <img src={LOGOS[i]} alt={t} width={LOGO_DIM[i][0]} height={LOGO_DIM[i][1]} loading="lazy" />
              <b>{t}</b>
              <span>{s}</span>
            </div>
          ))}
        </div>

        <section className="sdi-sec" aria-labelledby="sdi-sol">
          <h2 id="sdi-sol" className="sdi-h2">{c.solTitle}</h2>
          <p className="sdi-sub">{c.solSub}</p>
          <div className="sdi-cards">
            {c.sol.map(([t, d, , form], i) => {
              const Ic = SOL_ICONS[i];
              return (
                <div className="sdi-card" key={t}>
                  <div className="sdi-card-img" style={{ backgroundImage: `url(${SOL_IMGS[i]}), radial-gradient(60% 60% at 50% 70%, #ffffff 0%, #e9eef5 70%)`, backgroundSize: i === 0 ? '96% auto, cover' : i === 3 ? '60% auto, cover' : 'auto 78%, cover', backgroundBlendMode: 'multiply, normal' }} role="img" aria-label={t} />
                  <div className="sdi-card-b">
                    <div className="sdi-card-ic"><Ic size={18} /></div>
                    <h3>{t}</h3>
                    <p>{d}</p>
                    <div className="sdi-card-a">
                      <a href={`${p.kb}?tab=catalogo&cat=${SOL_CATS[i]}`}>{c.shop}<ArrowRight size={14} /></a>
                      <a href={`/f/${form}`}>{c.quote}</a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>


        <section className="sdi-sec">
          <div className="sdi-bento">
            <div className="sdi-panel">
              <Building2 />
              <h3>{c.storyTitle}</h3>
              <p>{c.story}</p>
              <div className="sdi-badges"><span>EESC-USP</span><span>FAPESP</span><span>CAPES</span><span>CNPq</span><span>ChairSide Print</span></div>
            </div>
            <div className="sdi-panel">
              <MapPin />
              <h3>{c.usTitle}</h3>
              <p>{c.us}</p>
              <div className="sdi-badges"><span><ShieldCheck size={12} style={{ verticalAlign: -2 }} /> FDA 3027526455</span><span><Award size={12} style={{ verticalAlign: -2 }} /> UNC Charlotte</span><span>ISO 10993</span><span>ANVISA</span></div>
            </div>
            <div className="sdi-panel">
              <Globe2 />
              <h3>{c.distTitle}</h3>
              <p>{c.dist}</p>
              <div className="sdi-panel-a">
                <a href="/distribuidores">{c.distCta1}<ArrowRight size={14} /></a>
                <a className="or" href="/cadastro-distribuidor">{c.distCta2}<ArrowRight size={14} /></a>
              </div>
            </div>
          </div>
        </section>

        <div className="sdi-band">
          <div><h2>{c.boughtTitle}</h2><p>{c.boughtSub}</p></div>
          <a className="sdi-btn pri" href={`${p.kb}?tab=parametros`}>{c.ctaParams}<ArrowRight size={16} /></a>
        </div>

        <section className="sdi-sec sdi-faq" aria-labelledby="sdi-faq">
          <h2 id="sdi-faq" className="sdi-h2" style={{ marginBottom: 20 }}>{c.faqTitle}</h2>
          {c.faq.map(([q, a], i) => (
            <div className={`sdi-q${open === i ? ' on' : ''}`} key={q}>
              <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>{q}<ChevronDown size={20} /></button>
              <div><p>{a}</p></div>
            </div>
          ))}
        </section>
      </div>

      <section className="sdi-final">
        <div className="sdi-wrap">
          <h2 className="sdi-h2">{c.finalTitle}</h2>
          <p>{c.final}</p>
          <div className="sdi-ctas">
            <a className="sdi-btn pri" href={wa} target="_blank" rel="noopener"><MessageCircle size={18} />{c.ctaTalk}</a>
            <a className="sdi-btn gho" href={WA_SUPPORT + encodeURIComponent(c.waSupport)} target="_blank" rel="noopener">{c.support}</a>
          </div>
          <nav className="sdi-links" aria-label="Smart Dent">
            <a href={`${STORE}/impressoras-3d`} target="_blank" rel="noopener">Impressoras 3D</a>
            <a href={`${STORE}/scanners-3d`} target="_blank" rel="noopener">Scanners</a>
            <a href={`${STORE}/resinas-3d`} target="_blank" rel="noopener">Resinas 3D</a>
            <a href={p.kb}>{c.kb}</a>
            <a href="https://smartdentacademy.astronmembers.com/cadastro/1420" target="_blank" rel="noopener"><GraduationCap size={13} style={{ verticalAlign: -2 }} /> {c.courses}</a>
          </nav>
        </div>
      </section>
    </article>
  );
}
