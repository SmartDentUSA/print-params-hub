import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { ArrowRight, MessageCircle, ShieldCheck, GraduationCap, Printer, ScanLine, Layers, Sparkles, Beaker, ChevronDown, MapPin, Building2, FlaskConical, Award } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import heroImg from '@/assets/institucional-hero.jpg';

type Lang = 'pt' | 'en' | 'es';
const SITE = 'https://parametros.smartdent.com.br';
const STORE = 'https://loja.smartdent.com.br';
const IMG = 'https://pgfgripuanuwwolmtknn.supabase.co/storage/v1/object/public/landing-page-images/';
const WA_SALES = 'https://api.whatsapp.com/send?phone=5516993831794&text=';
const WA_SUPPORT = 'https://api.whatsapp.com/send/?phone=551634194735&text=';

const PATHS: Record<Lang, { kb: string; home: string }> = {
  pt: { kb: '/base-conhecimento', home: '/institucional' },
  en: { kb: '/en/knowledge-base', home: '/en/institutional' },
  es: { kb: '/es/base-conocimiento', home: '/es/institucional' },
};

const C = {
  pt: {
    seoTitle: 'Smart Dent — Odontologia Digital End-to-End | Resinas 3D, Scanners e Impressoras',
    seoDesc: 'Smart Dent: spin-off da USP São Carlos desde 2009, parceira da UNC Charlotte e registrada no FDA. Resinas 3D, scanners intraorais, impressoras 3D, softwares CAD e treinamento.',
    eyebrow: 'Workflow Digital End-to-End',
    h1a: 'O fluxo digital mais', h1b: 'seguro, potente e lucrativo', h1c: 'do mercado.',
    lead: 'Mais que equipamentos ou softwares, entregamos autonomia e rentabilidade. Nosso ecossistema otimiza sua hora clínica ou laboratório, tornando a odontologia digital um investimento de altíssimo retorno e viabilidade imediata.',
    tldr: 'Em resumo: a Smart Dent é uma empresa brasileira de odontologia digital (São Carlos-SP, 2009) com subsidiária nos EUA (Charlotte-NC), que fornece resinas 3D biocompatíveis, scanners, impressoras, softwares CAD e treinamento com suporte técnico incluso.',
    ctaTalk: 'Falar com especialista', ctaStore: 'Visitar a loja', ctaParams: 'Acessar parâmetros',
    stats: [['2009', 'Fundação em São Carlos-SP'], ['FDA', 'Est. nº 3027526455'], ['12+', 'UDIs no AccessGUDID'], ['R1', 'Parceira UNC Charlotte']],
    solTitle: 'Nossas soluções', solSub: 'Tudo o que o consultório e o laboratório precisam — do escaneamento ao acabamento.',
    sol: [
      ['Resinas 3D odontológicas', 'Biocompatíveis, com certificações ISO 10993, ANVISA e FDA.', 'resinas-3d', 'resina-3d-smartprint-bio-vitality'],
      ['Scanners intraorais e bancada', 'Medit i600, i700 e BLZ INO200 com suporte nacional.', 'scanners-3d', 'ios-medit-i600'],
      ['Impressoras 3D odontológicas', 'Rayshape, Asiga, Elegoo e o fluxo ChairSide Print.', 'impressoras-3d', 'impressora-3d-rayshape-edge-mini'],
      ['Softwares de planejamento', 'exocad DentalCAD, exoplan e Smart Slicer.', 'exocad-software-cad', 'software-cad-exocad-dentcad'],
      ['Pós-cura e caracterização', 'Asiga Cure, ShapeCure, SmartMake, SmartGum e GlazeON.', 'maleta-smart-make', 'caracterizacao-smart-make'],
      ['Limpeza e cimentação', 'NanoClean, cimento UNIKK e adesivo SmartOrto.', 'nanoclean', 'cimento-unikk'],
    ],
    shop: 'Ver na loja', quote: 'Solicitar proposta',
    flowTitle: 'Como funciona', flow: [['Consultoria gratuita', 'Entendemos seu fluxo e seu investimento.'], ['Proposta sob medida', 'Apenas o que faz sentido para o seu negócio.'], ['Entrega e instalação', 'Contrato, nota fiscal e instalação assistida.'], ['Treinamento e suporte', 'Cursos presenciais e online com suporte incluso.']],
    storyTitle: 'Ciência aplicada à odontologia', story: 'Fundada em 2009 em São Carlos (SP) como MMTech Projetos Tecnológicos, liderada por Marcelo Del Guerra e Marcelo Cestari, com background na EESC-USP. Nasceu da pesquisa aplicada em materiais odontológicos e manufatura CNC, com apoio de FAPESP, CAPES e CNPq — e culminou no fluxo ChairSide Print, que leva a odontologia digital para dentro do consultório.',
    usTitle: 'Presença nos Estados Unidos', us: 'Desde 2022 a MMTech North America LLC opera em Charlotte (NC), com escritório na 10800 Sikes Place e presença no campus da UNC Charlotte (Grigg Hall 146) como University Business Partner — universidade de pesquisa R1.',
    boughtTitle: 'Comprou nossa resina?', boughtSub: 'Encontre os parâmetros validados para a sua impressora 3D.',
    faqTitle: 'Perguntas frequentes',
    faq: [
      ['O que é a Smart Dent?', 'Empresa especializada em odontologia digital que oferece equipamentos, insumos e suporte técnico para CAD/CAM, impressão 3D, escaneamento intraoral e fresagem.'],
      ['Para quem são as soluções?', 'Cirurgiões-dentistas, laboratórios de prótese, ortodontistas e clínicas — de quem está começando a laboratórios de alto volume.'],
      ['Há suporte técnico e treinamento?', 'Sim. Todo produto tem suporte técnico especializado incluso, além de cursos presenciais e online.'],
      ['Existe financiamento?', 'Sim. Parcelamento facilitado de equipamentos e condições especiais para clínicas e laboratórios com múltiplas unidades.'],
      ['Os equipamentos têm garantia?', 'Sim, com prazo e cobertura conforme fabricante e linha, além de manutenção preventiva e peças de reposição.'],
      ['Atendem todo o Brasil?', 'Sim, com equipe comercial e suporte centralizado em todo o território nacional.'],
      ['Os produtos são certificados?', 'Sim. Os materiais seguem ISO 10993, ANVISA e FDA, garantindo biocompatibilidade e segurança clínica.'],
    ],
    finalTitle: 'Compromisso com a sua jornada', final: 'Nossos especialistas entendem a fundo o seu fluxo de trabalho e oferecem apenas o que realmente faz sentido para o seu negócio.',
    support: 'Suporte técnico', courses: 'Cursos online', kb: 'Base de conhecimento',
    waSales: 'Olá, tudo bem? Vim pela página institucional da Smart Dent e gostaria de falar com um especialista.',
    waSupport: 'Olá, Smart Dent, preciso de informações de suporte.',
  },
  en: {
    seoTitle: 'Smart Dent — End-to-End Digital Dentistry | 3D Resins, Scanners & Printers',
    seoDesc: 'Smart Dent: USP spin-off since 2009, UNC Charlotte partner and FDA-registered. Biocompatible 3D resins, intraoral scanners, 3D printers, CAD software and training.',
    eyebrow: 'End-to-End Digital Workflow',
    h1a: 'The safest, most', h1b: 'powerful and profitable', h1c: 'digital workflow.',
    lead: 'More than equipment or software, we deliver autonomy and profitability. Our ecosystem optimizes your clinical or lab hour, making digital dentistry a high-return investment with immediate viability.',
    tldr: 'In short: Smart Dent is a Brazilian digital dentistry company (São Carlos, 2009) with a US subsidiary (Charlotte, NC), supplying biocompatible 3D resins, scanners, printers, CAD software and training with technical support included.',
    ctaTalk: 'Talk to a specialist', ctaStore: 'Visit the store', ctaParams: 'Printing parameters',
    stats: [['2009', 'Founded in São Carlos, Brazil'], ['FDA', 'Est. No. 3027526455'], ['12+', 'UDIs on AccessGUDID'], ['R1', 'UNC Charlotte partner']],
    solTitle: 'Our solutions', solSub: 'Everything clinics and labs need — from scanning to finishing.',
    sol: [
      ['Dental 3D resins', 'Biocompatible, ISO 10993, ANVISA and FDA certified.', 'resinas-3d', 'resina-3d-smartprint-bio-vitality'],
      ['Intraoral & desktop scanners', 'Medit i600, i700 and BLZ INO200.', 'scanners-3d', 'ios-medit-i600'],
      ['Dental 3D printers', 'Rayshape, Asiga, Elegoo and the ChairSide Print workflow.', 'impressoras-3d', 'impressora-3d-rayshape-edge-mini'],
      ['Planning software', 'exocad DentalCAD, exoplan and Smart Slicer.', 'exocad-software-cad', 'software-cad-exocad-dentcad'],
      ['Post-curing & characterization', 'Asiga Cure, ShapeCure, SmartMake, SmartGum and GlazeON.', 'maleta-smart-make', 'caracterizacao-smart-make'],
      ['Cleaning & cementation', 'NanoClean, UNIKK cement and SmartOrto adhesive.', 'nanoclean', 'cimento-unikk'],
    ],
    shop: 'Shop', quote: 'Request a quote',
    flowTitle: 'How it works', flow: [['Free consultation', 'We understand your workflow and budget.'], ['Tailored proposal', 'Only what makes sense for your business.'], ['Delivery & setup', 'Contract, invoice and assisted installation.'], ['Training & support', 'In-person and online courses, support included.']],
    storyTitle: 'Science applied to dentistry', story: 'Founded in 2009 in São Carlos, Brazil, as MMTech, led by Marcelo Del Guerra and Marcelo Cestari with an EESC-USP academic background. Born from applied research in dental materials and CNC manufacturing, funded by FAPESP, CAPES and CNPq — leading to the ChairSide Print workflow.',
    usTitle: 'Presence in the United States', us: 'Since 2022, MMTech North America LLC operates in Charlotte, NC (10800 Sikes Place) and on the UNC Charlotte campus (Grigg Hall 146) as a University Business Partner of this R1 research university.',
    boughtTitle: 'Bought our resin?', boughtSub: 'Find validated parameters for your 3D printer.',
    faqTitle: 'Frequently asked questions',
    faq: [
      ['What is Smart Dent?', 'A digital dentistry company providing equipment, materials and technical support for CAD/CAM, 3D printing, intraoral scanning and milling.'],
      ['Who are the solutions for?', 'Dentists, dental labs, orthodontists and clinics — from beginners to high-volume labs.'],
      ['Is support and training included?', 'Yes. Every product includes specialized technical support, plus in-person and online courses.'],
      ['Is financing available?', 'Yes, with installment plans and special conditions for multi-unit clinics and labs.'],
      ['Do products have a warranty?', 'Yes, according to manufacturer and product line, plus preventive maintenance and spare parts.'],
      ['Are products certified?', 'Yes. Materials follow ISO 10993, ANVISA and FDA standards for biocompatibility and clinical safety.'],
    ],
    finalTitle: 'Committed to your journey', final: 'Our specialists deeply understand your workflow and offer only what truly makes sense for your business.',
    support: 'Technical support', courses: 'Online courses', kb: 'Knowledge base',
    waSales: 'Hello! I came from the Smart Dent institutional page and would like to talk to a specialist.',
    waSupport: 'Hello Smart Dent, I need support information.',
  },
  es: {
    seoTitle: 'Smart Dent — Odontología Digital End-to-End | Resinas 3D, Escáneres e Impresoras',
    seoDesc: 'Smart Dent: spin-off de la USP desde 2009, socia de UNC Charlotte y registrada en la FDA. Resinas 3D, escáneres intraorales, impresoras 3D, software CAD y formación.',
    eyebrow: 'Flujo Digital End-to-End',
    h1a: 'El flujo digital más', h1b: 'seguro, potente y rentable', h1c: 'del mercado.',
    lead: 'Más que equipos o software, entregamos autonomía y rentabilidad. Nuestro ecosistema optimiza su hora clínica o de laboratorio, haciendo de la odontología digital una inversión de altísimo retorno.',
    tldr: 'En resumen: Smart Dent es una empresa brasileña de odontología digital (São Carlos, 2009) con filial en EE. UU. (Charlotte, NC), que ofrece resinas 3D biocompatibles, escáneres, impresoras, software CAD y formación con soporte técnico incluido.',
    ctaTalk: 'Hablar con un especialista', ctaStore: 'Visitar la tienda', ctaParams: 'Parámetros de impresión',
    stats: [['2009', 'Fundada en São Carlos, Brasil'], ['FDA', 'Est. nº 3027526455'], ['12+', 'UDIs en AccessGUDID'], ['R1', 'Socia de UNC Charlotte']],
    solTitle: 'Nuestras soluciones', solSub: 'Todo lo que clínicas y laboratorios necesitan — del escaneo al acabado.',
    sol: [
      ['Resinas 3D odontológicas', 'Biocompatibles, certificadas ISO 10993, ANVISA y FDA.', 'resinas-3d', 'resina-3d-smartprint-bio-vitality'],
      ['Escáneres intraorales y de mesa', 'Medit i600, i700 y BLZ INO200.', 'scanners-3d', 'ios-medit-i600'],
      ['Impresoras 3D odontológicas', 'Rayshape, Asiga, Elegoo y el flujo ChairSide Print.', 'impressoras-3d', 'impressora-3d-rayshape-edge-mini'],
      ['Software de planificación', 'exocad DentalCAD, exoplan y Smart Slicer.', 'exocad-software-cad', 'software-cad-exocad-dentcad'],
      ['Poscurado y caracterización', 'Asiga Cure, ShapeCure, SmartMake, SmartGum y GlazeON.', 'maleta-smart-make', 'caracterizacao-smart-make'],
      ['Limpieza y cementación', 'NanoClean, cemento UNIKK y adhesivo SmartOrto.', 'nanoclean', 'cimento-unikk'],
    ],
    shop: 'Ver en la tienda', quote: 'Solicitar propuesta',
    flowTitle: 'Cómo funciona', flow: [['Consultoría gratuita', 'Entendemos su flujo y su inversión.'], ['Propuesta a medida', 'Solo lo que tiene sentido para su negocio.'], ['Entrega e instalación', 'Contrato, factura e instalación asistida.'], ['Formación y soporte', 'Cursos presenciales y online con soporte incluido.']],
    storyTitle: 'Ciencia aplicada a la odontología', story: 'Fundada en 2009 en São Carlos (Brasil) como MMTech, liderada por Marcelo Del Guerra y Marcelo Cestari, con formación en la EESC-USP. Nació de la investigación aplicada en materiales dentales y manufactura CNC, con apoyo de FAPESP, CAPES y CNPq.',
    usTitle: 'Presencia en Estados Unidos', us: 'Desde 2022, MMTech North America LLC opera en Charlotte (NC), en 10800 Sikes Place y en el campus de UNC Charlotte (Grigg Hall 146) como University Business Partner, universidad de investigación R1.',
    boughtTitle: '¿Compró nuestra resina?', boughtSub: 'Encuentre los parámetros validados para su impresora 3D.',
    faqTitle: 'Preguntas frecuentes',
    faq: [
      ['¿Qué es Smart Dent?', 'Empresa de odontología digital que ofrece equipos, insumos y soporte técnico para CAD/CAM, impresión 3D, escaneo intraoral y fresado.'],
      ['¿Para quién son las soluciones?', 'Odontólogos, laboratorios, ortodoncistas y clínicas — desde principiantes hasta laboratorios de alto volumen.'],
      ['¿Incluye soporte y formación?', 'Sí. Todo producto incluye soporte técnico especializado y cursos presenciales y online.'],
      ['¿Hay financiación?', 'Sí, con pagos en cuotas y condiciones especiales para clínicas y laboratorios.'],
      ['¿Los equipos tienen garantía?', 'Sí, según fabricante y línea, con mantenimiento preventivo y repuestos.'],
      ['¿Los productos están certificados?', 'Sí. Siguen ISO 10993, ANVISA y FDA, garantizando biocompatibilidad y seguridad clínica.'],
    ],
    finalTitle: 'Compromiso con su camino', final: 'Nuestros especialistas entienden a fondo su flujo de trabajo y ofrecen solo lo que realmente tiene sentido para su negocio.',
    support: 'Soporte técnico', courses: 'Cursos online', kb: 'Base de conocimiento',
    waSales: '¡Hola! Vengo de la página institucional de Smart Dent y quisiera hablar con un especialista.',
    waSupport: 'Hola Smart Dent, necesito información de soporte.',
  },
} as const;

const SOL_ICONS = [Beaker, ScanLine, Printer, Layers, Sparkles, FlaskConical];
const SOL_IMGS = ['zdaohxi7e3_1768439101916.png', 'ivfswu0ncpg_1768439293931.png', 'zboysil9dqc_1768439495195.png', 'ikain1x6wfa_1768439639882.png', 'iwscpzp2ggc_1768439749969.png', 'rbk3n79mqbc_1768439795135.png'];

const css = `
.sdi{--ink:#07111f;--ink2:#0c1b30;--line:rgba(148,197,255,.14);--txt:#e8f0fb;--mut:#93a7c3;--cy:#38d6f5;--cy2:#7cf0d4;--gold:#f3c969;
  font-family:'Sora','Manrope',system-ui,sans-serif;color:var(--txt);background:var(--ink);border-radius:28px;overflow:hidden;margin:-8px 0 24px;position:relative;isolation:isolate}
.sdi *{box-sizing:border-box}
.sdi a{color:inherit;text-decoration:none}
.sdi-wrap{max-width:1180px;margin:0 auto;padding:0 clamp(20px,4vw,48px)}
.sdi-hero{position:relative;min-height:640px;display:flex;align-items:center;padding:96px 0 72px}
.sdi-hero-bg{position:absolute;inset:0;z-index:-1;background:url(var(--img)) center/cover}
.sdi-hero-bg:after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,var(--ink) 18%,rgba(7,17,31,.82) 48%,rgba(7,17,31,.25) 100%),linear-gradient(0deg,var(--ink),transparent 40%)}
.sdi-grid-fx{position:absolute;inset:0;z-index:-1;opacity:.35;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(ellipse at 20% 40%,#000 10%,transparent 70%)}
.sdi-eyebrow{display:inline-flex;gap:8px;align-items:center;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--cy);border:1px solid rgba(56,214,245,.35);background:rgba(56,214,245,.08);padding:7px 14px;border-radius:999px}
.sdi-eyebrow i{width:6px;height:6px;border-radius:50%;background:var(--cy);box-shadow:0 0 12px var(--cy);animation:sdiPulse 2s infinite}
@keyframes sdiPulse{50%{opacity:.3}}
.sdi h1{font-size:clamp(36px,5.4vw,68px);line-height:1.02;letter-spacing:-.035em;font-weight:700;margin:22px 0 20px;max-width:780px}
.sdi h1 em{font-style:normal;background:linear-gradient(90deg,var(--cy),var(--cy2));-webkit-background-clip:text;background-clip:text;color:transparent}
.sdi-lead{font-size:clamp(16px,1.35vw,19px);line-height:1.65;color:var(--mut);max-width:620px}
.sdi-tldr{margin-top:22px;max-width:620px;font-size:13.5px;line-height:1.6;color:#c6d4e8;border-left:2px solid var(--cy);padding:4px 0 4px 14px}
.sdi-ctas{display:flex;flex-wrap:wrap;gap:12px;margin-top:32px}
.sdi-btn{display:inline-flex;align-items:center;gap:10px;height:52px;padding:0 24px;border-radius:14px;font-weight:600;font-size:15px;transition:transform .25s,box-shadow .25s,background .25s}
.sdi-btn:hover{transform:translateY(-2px)}
.sdi-btn.pri{background:linear-gradient(135deg,var(--cy),var(--cy2));color:#04121e;box-shadow:0 12px 40px -12px rgba(56,214,245,.7)}
.sdi-btn.gho{border:1px solid var(--line);background:rgba(255,255,255,.04);backdrop-filter:blur(8px)}
.sdi-btn.gho:hover{background:rgba(255,255,255,.09)}
.sdi-stats{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-radius:20px;background:rgba(12,27,48,.7);backdrop-filter:blur(14px);margin-top:-44px;position:relative}
.sdi-stat{padding:26px 24px;border-left:1px solid var(--line)}.sdi-stat:first-child{border:0}
.sdi-stat b{display:block;font-size:30px;letter-spacing:-.03em;color:var(--txt)}.sdi-stat span{font-size:13px;color:var(--mut)}
.sdi-sec{padding:96px 0 0}
.sdi-h2{font-size:clamp(28px,3.4vw,44px);letter-spacing:-.03em;line-height:1.1;margin:0 0 12px;font-weight:700}
.sdi-sub{color:var(--mut);font-size:16px;max-width:560px;margin:0 0 40px}
.sdi-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.sdi-card{position:relative;border:1px solid var(--line);border-radius:22px;overflow:hidden;background:linear-gradient(180deg,var(--ink2),var(--ink));display:flex;flex-direction:column;transition:transform .35s,border-color .35s}
.sdi-card:hover{transform:translateY(-6px);border-color:rgba(56,214,245,.45)}
.sdi-card-img{height:190px;background:#0a1626 center/contain no-repeat;border-bottom:1px solid var(--line);transition:transform .6s}
.sdi-card:hover .sdi-card-img{transform:scale(1.04)}
.sdi-card-b{padding:22px;display:flex;flex-direction:column;gap:10px;flex:1}
.sdi-card-ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:rgba(56,214,245,.1);color:var(--cy)}
.sdi-card h3{font-size:18px;margin:4px 0 0;letter-spacing:-.01em}.sdi-card p{margin:0;color:var(--mut);font-size:14px;line-height:1.55;flex:1}
.sdi-card-a{display:flex;gap:14px;margin-top:10px;font-size:13.5px;font-weight:600}
.sdi-card-a a{display:inline-flex;align-items:center;gap:6px;color:var(--cy)}.sdi-card-a a+a{color:var(--txt);opacity:.8}
.sdi-steps{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;counter-reset:s}
.sdi-step{padding:26px;border-radius:20px;border:1px solid var(--line);background:rgba(255,255,255,.02);position:relative}
.sdi-step:before{counter-increment:s;content:"0" counter(s);font-size:40px;font-weight:700;letter-spacing:-.04em;background:linear-gradient(180deg,var(--cy),transparent);-webkit-background-clip:text;background-clip:text;color:transparent;display:block;margin-bottom:14px}
.sdi-step h3{margin:0 0 6px;font-size:16px}.sdi-step p{margin:0;color:var(--mut);font-size:14px;line-height:1.55}
.sdi-bento{display:grid;grid-template-columns:1.3fr 1fr;gap:18px}
.sdi-panel{border:1px solid var(--line);border-radius:24px;padding:36px;background:radial-gradient(120% 120% at 0% 0%,rgba(56,214,245,.12),transparent 55%),var(--ink2)}
.sdi-panel h3{font-size:24px;margin:14px 0 12px;letter-spacing:-.02em}.sdi-panel p{color:var(--mut);line-height:1.7;margin:0;font-size:15px}
.sdi-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px}.sdi-badges span{font-size:12px;padding:6px 12px;border-radius:999px;border:1px solid var(--line);color:#c6d4e8}
.sdi-band{margin-top:96px;border-radius:24px;padding:44px;display:flex;align-items:center;justify-content:space-between;gap:24px;flex-wrap:wrap;background:linear-gradient(120deg,rgba(56,214,245,.18),rgba(124,240,212,.08)),var(--ink2);border:1px solid rgba(56,214,245,.3)}
.sdi-band h2{margin:0;font-size:clamp(24px,2.6vw,34px);letter-spacing:-.02em}.sdi-band p{margin:6px 0 0;color:var(--mut)}
.sdi-faq{max-width:860px}
.sdi-q{border-bottom:1px solid var(--line)}
.sdi-q button{all:unset;cursor:pointer;display:flex;justify-content:space-between;gap:16px;width:100%;padding:22px 0;font-size:17px;font-weight:600}
.sdi-q svg{transition:transform .3s;flex:none;color:var(--cy)}.sdi-q.on svg{transform:rotate(180deg)}
.sdi-q div{display:grid;grid-template-rows:0fr;transition:grid-template-rows .35s}.sdi-q.on div{grid-template-rows:1fr}
.sdi-q p{overflow:hidden;margin:0;color:var(--mut);line-height:1.7}.sdi-q.on p{padding-bottom:22px}
.sdi-final{margin:96px 0 0;padding:80px 0;text-align:center;background:radial-gradient(60% 100% at 50% 0%,rgba(56,214,245,.18),transparent 70%);border-top:1px solid var(--line)}
.sdi-final p{color:var(--mut);max-width:600px;margin:0 auto 28px;line-height:1.7}
.sdi-final .sdi-ctas{justify-content:center}
.sdi-links{display:flex;justify-content:center;gap:22px;flex-wrap:wrap;margin-top:28px;font-size:14px;color:var(--mut)}.sdi-links a:hover{color:var(--cy)}
.sdi-rv{animation:sdiUp .8s cubic-bezier(.2,.7,.2,1) both}.sdi-rv.d1{animation-delay:.1s}.sdi-rv.d2{animation-delay:.2s}.sdi-rv.d3{animation-delay:.3s}
@keyframes sdiUp{from{opacity:0;transform:translateY(18px)}}
@media(prefers-reduced-motion:reduce){.sdi *{animation:none!important;transition:none!important}}
@media(max-width:960px){.sdi-cards{grid-template-columns:repeat(2,1fr)}.sdi-steps{grid-template-columns:repeat(2,1fr)}.sdi-bento{grid-template-columns:1fr}.sdi-stats{grid-template-columns:repeat(2,1fr)}.sdi-stat:nth-child(3){border-left:0}.sdi-stat:nth-child(n+3){border-top:1px solid var(--line)}}
@media(max-width:600px){.sdi-cards,.sdi-steps{grid-template-columns:1fr}.sdi-hero{min-height:560px;padding-top:64px}.sdi-panel,.sdi-band{padding:26px}}
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
        itemListElement: c.sol.map((s, i) => ({ '@type': 'ListItem', position: i + 1, name: s[0], url: `${STORE}/${s[2]}` })),
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
        <div className="sdi-hero-bg" style={{ backgroundImage: `url(${heroImg})` }} aria-hidden />
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
        <div className="sdi-stats">
          {c.stats.map(([b, s]) => <div className="sdi-stat" key={b}><b>{b}</b><span>{s}</span></div>)}
        </div>

        <section className="sdi-sec" aria-labelledby="sdi-sol">
          <h2 id="sdi-sol" className="sdi-h2">{c.solTitle}</h2>
          <p className="sdi-sub">{c.solSub}</p>
          <div className="sdi-cards">
            {c.sol.map(([t, d, cat, form], i) => {
              const Ic = SOL_ICONS[i];
              return (
                <div className="sdi-card" key={t}>
                  <div className="sdi-card-img" style={{ backgroundImage: `url(${IMG}${SOL_IMGS[i]})` }} role="img" aria-label={t} />
                  <div className="sdi-card-b">
                    <div className="sdi-card-ic"><Ic size={18} /></div>
                    <h3>{t}</h3>
                    <p>{d}</p>
                    <div className="sdi-card-a">
                      <a href={`${STORE}/${cat}`} target="_blank" rel="noopener">{c.shop}<ArrowRight size={14} /></a>
                      <a href={`/f/${form}`}>{c.quote}</a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="sdi-sec" aria-labelledby="sdi-flow">
          <h2 id="sdi-flow" className="sdi-h2">{c.flowTitle}</h2>
          <div className="sdi-steps" style={{ marginTop: 32 }}>
            {c.flow.map(([t, d]) => <div className="sdi-step" key={t}><h3>{t}</h3><p>{d}</p></div>)}
          </div>
        </section>

        <section className="sdi-sec">
          <div className="sdi-bento">
            <div className="sdi-panel">
              <Building2 color="#38d6f5" />
              <h3>{c.storyTitle}</h3>
              <p>{c.story}</p>
              <div className="sdi-badges"><span>EESC-USP</span><span>FAPESP</span><span>CAPES</span><span>CNPq</span><span>ChairSide Print</span></div>
            </div>
            <div className="sdi-panel">
              <MapPin color="#38d6f5" />
              <h3>{c.usTitle}</h3>
              <p>{c.us}</p>
              <div className="sdi-badges"><span><ShieldCheck size={12} style={{ verticalAlign: -2 }} /> FDA 3027526455</span><span><Award size={12} style={{ verticalAlign: -2 }} /> UNC Charlotte</span><span>ISO 10993</span><span>ANVISA</span></div>
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
