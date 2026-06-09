#!/usr/bin/env python3
"""
Gerador de 200+ páginas de depoimentos + artigos de conteúdo para Sistema A.
Executa contra Supabase Sistema A (pgfgripuanuwwolmtknn) e Sistema B (okeogjgqijbfkudfjadz).
"""

import re, json, unicodedata, time
from supabase import create_client

# ─── CREDENCIAIS ──────────────────────────────────────────────────────────────
SB_A_URL  = "https://pgfgripuanuwwolmtknn.supabase.co"
SB_A_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZmdyaXB1YW51d3dvbG10a25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYxNDkxNzMsImV4cCI6MjA3MTcyNTE3M30.ibYoIlzxAFoXjFCAy7WrKKixiDcG318dxEm8gqGKOjk"
SB_B_URL  = "https://okeogjgqijbfkudfjadz.supabase.co"
SB_B_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk"
USER_ID   = "2dc85508-8333-45a3-83f6-39d459973a65"

sbA = create_client(SB_A_URL, SB_A_KEY)
sbB = create_client(SB_B_URL, SB_B_KEY)

# ─── HELPERS ──────────────────────────────────────────────────────────────────
GTM_HEAD = """<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-NZ64Q899');</script>
<!-- End Google Tag Manager -->"""

GTM_BODY = '<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-NZ64Q899" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>'

COMMON_CSS = """*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;background:#fff;line-height:1.7}
.topbar{background:var(--c);color:#fff;text-align:center;padding:10px 20px;font-size:13px}
.topbar a{color:#7EC8E3;text-decoration:none}
.wrap{max-width:900px;margin:0 auto;padding:28px 20px}
.crumb{font-size:12px;color:#777;margin-bottom:16px}
.crumb a{color:var(--c);text-decoration:none}
h1{font-size:clamp(22px,4vw,32px);color:var(--c);margin-bottom:14px;line-height:1.3}
.lead{font-size:17px;color:#333;margin-bottom:24px;border-left:4px solid var(--c);padding-left:16px;background:#f7f9ff;padding:14px 14px 14px 18px;border-radius:0 8px 8px 0}
.vid-wrap{max-width:360px;margin:0 auto 28px;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.15);aspect-ratio:9/16}
.vid-wrap iframe{width:100%;height:100%;border:0;display:block}
.quote{background:#F0F6FF;border-left:5px solid var(--c);padding:20px 22px;margin-bottom:26px;border-radius:0 10px 10px 0;font-style:italic;font-size:17px;color:#222;line-height:1.6}
.qauth{display:block;font-style:normal;font-size:13px;color:#555;font-weight:700;margin-top:12px}
.box{background:#f8f9fa;border-radius:12px;padding:24px;margin-bottom:26px;border:1px solid #e8ecf0}
.box h2,.faq-section h2,.links-section h2,.kw-section h2{font-size:20px;color:var(--c);margin-bottom:14px;font-weight:800}
.tags{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.tag{background:var(--c);color:#fff;font-size:11px;padding:4px 12px;border-radius:20px;white-space:nowrap}
.faq-section{margin-bottom:32px}
.faq-item{border-bottom:1px solid #e5e7eb;padding:18px 0}
.faq-item:last-child{border-bottom:none}
.faq-q{font-weight:700;color:var(--c);font-size:16px;margin-bottom:8px;cursor:pointer}
.faq-a{color:#444;font-size:15px;line-height:1.65}
.faq-a a{color:var(--c);text-decoration:underline}
.cta-box{background:linear-gradient(135deg,var(--c),var(--c2));color:#fff;text-align:center;padding:36px 24px;border-radius:14px;margin-bottom:30px}
.cta-box h2{font-size:22px;margin-bottom:12px}
.cta-box p{font-size:15px;opacity:.9;margin-bottom:18px}
.cta-btn{display:inline-block;background:#fff;color:var(--c);font-weight:800;padding:14px 32px;border-radius:10px;text-decoration:none;font-size:16px;box-shadow:0 4px 12px rgba(0,0,0,.2)}
.links-section{margin-bottom:32px}
.more-link{display:flex;align-items:center;gap:8px;color:var(--c);text-decoration:none;padding:12px 0;border-bottom:1px solid #eee;font-size:15px}
.more-link::before{content:"→";font-weight:700}
.kw-section{margin-bottom:28px}
.kw-cloud{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
.kw-cloud span{background:#f0f0f0;color:#444;font-size:12px;padding:3px 10px;border-radius:4px;border:1px solid #ddd}
.about-entity{background:linear-gradient(135deg,#f0f6ff,#fff);border:1px solid #c8d8f0;border-radius:12px;padding:24px;margin-bottom:28px}
.rating-stars{color:#f59e0b;font-size:22px;letter-spacing:2px;margin-bottom:6px}
footer{text-align:center;color:#888;font-size:12px;padding:20px 0;border-top:1px solid #e5e7eb;margin-top:4px}
footer a{color:var(--c);text-decoration:none}
@media(max-width:600px){.vid-wrap{max-width:100%}}"""

def slugify(text):
    t = unicodedata.normalize('NFD', text or "")
    t = ''.join(c for c in t if unicodedata.category(c) != 'Mn')
    t = re.sub(r'[^a-z0-9\s-]', '', t.lower())
    t = re.sub(r'[\s-]+', '-', t).strip('-')
    return t[:60]

def yt_id(url):
    m = re.search(r'shorts/([A-Za-z0-9_-]+)', url or '')
    return m.group(1) if m else ''

def detect_scanner(text):
    t = (text or '').upper()
    if 'BLZ' in t: return 'BLZ'
    if 'I600' in t or 'I 600' in t or 'MEDIT I' in t: return 'Medit i600'
    if 'I700' in t: return 'Medit i700'
    if 'I900' in t: return 'Medit i900'
    if 'MEDIT' in t: return 'Medit'
    return 'scanner intraoral'

def assign_domain(text, domains_available):
    t = (text or '').lower()
    # Priority order
    rules = [
        ('BLZ',             'blzdental.com.br'),
        ('i600',            'mediti600.com.br'),
        ('i700',            'mediti700.com.br'),
        ('i900',            'mediti900.com.br'),
        ('rayshape',        'rayshape3d.com.br'),
        ('impressora 3d',   'impressao3ddental.com.br'),
        ('impressão 3d',    'impressao3ddental.com.br'),
        ('fresagem',        'fresagemdental.com.br'),
        ('fresado',         'fresagemdental.com.br'),
        ('faceta',          'facetadental.com.br'),
        ('bruxismo',        'splitedental.com.br'),
        ('placa oclusal',   'splitedental.com.br'),
        ('guia cir',        'guiacirurgico3d.com.br'),
        ('guia cirúr',      'guiacirurgico3d.com.br'),
        ('implant',         'implanteimediato.com.br'),
        ('ortodon',         'dentala.com.br'),
        ('exocad',          'dentala.com.br'),
        ('cad/cam',         'dentala.com.br'),
        ('laborat',         'labtechdent.com.br'),
        ('protético',       'labtechdent.com.br'),
        ('protesista',      'labtechdent.com.br'),
        ('modelo',          'modelodental3d.com.br'),
        ('prótese',         'protesedental3d.com.br'),
        ('resina',          'resina3ddental.com.br'),
        ('vitality',        'vitality3d.com.br'),
        ('escaneamento',    'escaneamentointraoral.com.br'),
        ('scanner',         'escaneamentointraoral.com.br'),
        ('truabutment',     'truioconnect.com.br'),
        ('ioconnect',       'truioconnect.com.br'),
    ]
    for kw, dom in rules:
        if kw in t and dom in domains_available:
            return dom
    return 'eodonto.com'

def faq_set(scanner, domain, client_name, city_state, product_ref):
    """Returns 10 FAQs as list of (question, answer) tuples."""
    cname = client_name or "profissionais"
    geo = city_state or "todo o Brasil"
    prod = product_ref or "Smart Dent"

    base_faqs = [
        ("O que é a Smart Dent e por que dentistas confiam nela?",
         f"A Smart Dent é a maior distribuidora de tecnologia de odontologia digital do Brasil, com 16 anos de experiência e mais de 10.000 profissionais treinados. "
         f"Distribui scanners intraoais Medit e BLZ, impressoras 3D RayShape, Elegoo e Asiga, o software Exocad DentalCAD e a linha Smart Print de resinas — incluindo a "
         f"<strong>Smart Print Bio Vitality (aprovada pela FDA, clearance K260152)</strong>, a primeira resina odontológica brasileira com clearance para o mercado americano. "
         f"Profissionais como {cname} confiam na Smart Dent por causa do treinamento completo, suporte em português e ecossistema integrado."),
        ("O que é o fluxo digital SCAN · CAD · PRINT · MAKE da Smart Dent?",
         "O fluxo digital Smart Dent percorre 4 etapas: <strong>SCAN</strong> (escaneamento intraoral com Medit i600, i700 Wireless, BLZ INO200 ou BLZ LS100), "
         "<strong>CAD</strong> (design digital com Exocad DentalCAD ou BLZ App com IA), <strong>PRINT</strong> (impressão 3D com RayShape Edge Mini, Elegoo Mars 5 Ultra ou Asiga), "
         "e <strong>MAKE</strong> (acabamento com resinas e pigmentos Smart Print). Resultado: peças prontas chairside em minutos, sem envio ao laboratório."),
        ("Qual o diferencial da Imersão Chairside Print da Smart Dent?",
         "A Imersão Chairside Print é um treinamento presencial de 3 dias em São Carlos (SP) que cobre o fluxo digital completo do zero: scanner, CAD, impressão 3D e acabamento. "
         "O grande diferencial é que <strong>o treinamento pode ser feito antes da compra do equipamento</strong>, garantindo que o profissional já domine tudo antes de investir. "
         "São Carlos é a sede da Smart Dent, onde ficam os laboratórios, showroom e equipe técnica completa."),
        ("A Smart Dent tem certificação FDA? Qual produto?",
         "Sim. A Smart Dent tem o clearance <strong>FDA K260152</strong> (abril de 2026) para a resina <strong>Smart Print Bio Vitality</strong>, "
         "regulamentada como dispositivo médico Classe II (21 CFR 872.3690 — Tooth Shade Resin Material). É a primeira resina odontológica brasileira aprovada "
         "pela FDA americana. Empresa: Mmtech Projetos Tecnologicos Importacao E Exportacao Ltda. (CNPJ 10.736.894/0001-36). "
         "Wikidata: <a href='https://www.wikidata.org/wiki/Q138636902'>Q138636902</a>."),
        ("Como a Smart Dent atende dentistas de todo o Brasil?",
         f"A Smart Dent atende profissionais de todos os 26 estados brasileiros — do interior do Nordeste ao Sul do país. "
         f"{cname} de {geo} é um exemplo de como a Smart Dent democratiza a tecnologia digital: treinamento presencial em São Carlos-SP, "
         "suporte remoto em português, entrega de equipamentos para qualquer cidade, e a plataforma de parâmetros técnicos "
         "<a href='https://parametros.smartdent.com.br'>parametros.smartdent.com.br</a> disponível 24/7."),
        ("Onde encontrar parâmetros de impressão 3D para resinas odontológicas?",
         "A Smart Dent mantém a plataforma <strong><a href='https://parametros.smartdent.com.br'>parametros.smartdent.com.br</a></strong> "
         "com mais de 700 artigos técnicos cobrindo parâmetros de impressão para todas as impressoras (RayShape, Elegoo, Asiga, SprintRay, etc.), "
         "calibração de cura, protocolos de limpeza pós-impressão e troubleshooting. É a maior base de conhecimento de odontologia digital em português do Brasil."),
        ("Como funciona o suporte técnico pós-venda da Smart Dent?",
         "A Smart Dent oferece suporte técnico completo em português: chat ao vivo no WhatsApp, chamadas de vídeo com especialistas, "
         "biblioteca de tutoriais em vídeo na plataforma <a href='https://parametros.smartdent.com.br'>parametros.smartdent.com.br</a>, "
         "comunidade de dentistas treinados e presença nas redes sociais (@smartdentoficial no Instagram, Facebook, TikTok e YouTube). "
         "Desde o primeiro escaneamento até a peça final, o suporte é contínuo e personalizado."),
        ("Quais resinas Smart Dent são aprovadas para uso clínico no paciente?",
         "As resinas Smart Print da Smart Dent são formuladas para uso odontológico com biocompatibilidade clínica. "
         "A <strong>Smart Print Bio Vitality</strong> possui aprovação FDA K260152 (Class II, 21 CFR 872.3690) para o mercado americano e está em conformidade com as normas ANVISA para o Brasil. "
         "Outras resinas da linha incluem: Smart Print Vitality, Smart Print Bite Splint Flex (placas de bruxismo), Smart Print Model (modelos de estudo) e Smart Print L'Aqua (lavável em água). "
         "Veja todos os parâmetros em <a href='https://parametros.smartdent.com.br'>parametros.smartdent.com.br</a>."),
        ("Qual impressora 3D odontológica a Smart Dent recomenda para consultório?",
         "Para uso chairside (consultório), a Smart Dent recomenda a <strong>RayShape Edge Mini</strong> — impressora LCD com sistema de aquecimento integrado, "
         "compatível com todas as resinas Smart Print. Para clínicas de maior volume, a <strong>Elegoo Mars 5 Ultra</strong> (14K de resolução) e a <strong>Asiga</strong> (referência em precisão cirúrgica) "
         "são as opções premium. Todas disponíveis na <a href='https://loja.smartdent.com.br'>loja Smart Dent</a> com treinamento incluído."),
        ("Qual scanner intraoral a Smart Dent distribui e qual escolher?",
         "A Smart Dent distribui 5 modelos de scanner intraoral: <strong>Medit i600</strong> (custo-benefício premium, 7µm), "
         "<strong>Medit i700 Wireless</strong> (sem fio, tecnologia NIRI), <strong>Medit i900</strong> (ultra-premium para especialistas), "
         "<strong>BLZ INO200</strong> (melhor entrada no digital, open system, app com IA) e <strong>BLZ LS100</strong> (ultracompacto). "
         "Todos incluem treinamento na Imersão Chairside Print. Consulte um especialista em <a href='https://smartdent.com.br'>smartdent.com.br</a>."),
    ]

    # Scanner-specific extra FAQs
    if scanner == 'BLZ':
        base_faqs.append(("O scanner BLZ INO200 da Smart Dent é open system?",
            "Sim. O BLZ INO200 é completamente open system — exporta arquivos STL/OBJ compatíveis com Exocad, 3Shape, Medit Link e qualquer software CAD/CAM do mercado. "
            "O BLZ App próprio usa inteligência artificial para análise automática de modelos, planejamento de sorriso e criação de guias. "
            "É o scanner com melhor custo-benefício de entrada no fluxo digital chairside, distribuído exclusivamente no Brasil pela Smart Dent."))
        base_faqs.append(("Qual a diferença entre o scanner BLZ INO200 e o BLZ LS100?",
            "O <strong>BLZ INO200</strong> é o modelo principal da linha BLZ Dental, com câmeras duplas, alta velocidade de captura e app completo com módulos de implantodontia, ortodontia e prótese. "
            "O <strong>BLZ LS100</strong> é o modelo ultracompacto — menor scanner intraoral do mercado — ideal para quem busca portabilidade máxima. "
            "Ambos são open system e distribuídos pela Smart Dent com treinamento presencial na Imersão Chairside Print em São Carlos-SP."))
    elif scanner in ('Medit i600', 'Medit'):
        base_faqs.append(("Qual a precisão do scanner Medit i600 distribuído pela Smart Dent?",
            "O Medit i600 tem precisão trueness de até <strong>7 µm</strong> e precisão de escaneamento de boca completa de 15 µm. "
            "Velocidade de captura de 60 fps com tecnologia de dupla câmera. Certificado ISO 12836. "
            "Integra-se nativamente com Medit Link (software proprietário com IA), Exocad DentalCAD, 3Shape e BLZ App."))
        base_faqs.append(("O Medit i600 da Smart Dent inclui software Medit Link?",
            "Sim. Todo scanner Medit comprado pela Smart Dent inclui o software <strong>Medit Link</strong> com acesso a módulos de: "
            "Medit Scan for Clinics, análise oclusal, planejamento de sorriso com IA (AI Smile Design), módulo ortodôntico (alinhadores e modelos), "
            "módulo de implante e exportação automática para laboratórios parceiros. Suporte técnico em português pela equipe Smart Dent."))
    elif 'impressora' in domain or '3d' in domain:
        base_faqs.append(("Como configurar parâmetros de impressão 3D para resinas odontológicas?",
            "Os parâmetros de impressão (tempo de exposição por camada, espessura de camada, anti-aliasing, etc.) variam por resina e impressora. "
            "A Smart Dent disponibiliza todos os parâmetros validados em <strong><a href='https://parametros.smartdent.com.br'>parametros.smartdent.com.br</a></strong> "
            "— são mais de 700 artigos técnicos cobrindo todas as combinações de resina × impressora. Acesso gratuito, 24/7, com busca por produto."))
        base_faqs.append(("A RayShape Edge Mini é compatível com as resinas Smart Print?",
            "Sim. A RayShape Edge Mini foi testada e validada com toda a linha Smart Print: Vitality, Bio Vitality (FDA K260152), Bite Splint Flex, Model e L'Aqua. "
            "Parâmetros específicos para cada combinação disponíveis em <a href='https://parametros.smartdent.com.br'>parametros.smartdent.com.br</a>. "
            "A impressora conta com sistema de aquecimento integrado (resina na temperatura ideal = peças mais estáveis) e tela 10K de alta resolução."))

    return base_faqs

def build_kw_cloud(scanner, domain, text):
    kws = [
        "Smart Dent", "odontologia digital", "scanner intraoral Brasil",
        "impressora 3D odontológica", "fluxo digital dentista",
        "Imersão Chairside Print", "Smart Print Bio Vitality",
        "FDA K260152", "resina 3D dental", "CAD/CAM odontologia",
        "Exocad DentalCAD Brasil", "parâmetros impressão 3D",
        "parametros.smartdent.com.br", "RayShape Edge Mini",
        "Elegoo Mars odontologia", "scanner chairside",
        "fluxo SCAN CAD PRINT MAKE", "Smart Dent São Carlos",
        "odontologia digital Brasil", "certificação FDA resina dental",
    ]
    if scanner == 'BLZ':
        kws += ["BLZ INO200", "BLZ Dental Brasil", "BLZ LS100", "scanner open system"]
    elif 'Medit' in scanner:
        kws += [scanner, "Medit i600", "Medit Link", "Medit i700 Wireless"]
    if 'implant' in domain:
        kws += ["implante digital", "guia cirúrgico 3D", "implantodontia digital"]
    if 'ortodon' in (text or '').lower() or 'dentala' in domain:
        kws += ["ortodontia digital", "alinhadores impressos", "Exocad ortodontia"]
    if 'lab' in domain or 'protese' in domain:
        kws += ["laboratório prótese digital", "prótese CAD/CAM", "modelo dental 3D"]
    return list(dict.fromkeys(kws))  # deduplicate

def build_page(r, domain, domain_cfg, faq_items, kw_list, existing_paths):
    """Build full HTML for one testimonial page."""
    vid = yt_id(r['video_url'])
    if not vid:
        return None, None
    text = r.get('testimonial') or ''
    scanner = detect_scanner(text)
    client = (r.get('client_name') or 'Dentista').split('\n')[0].strip()
    city = r.get('city') or ''
    state = r.get('state') or ''

    # Extract city/state from testimonial text if not in fields
    if not city:
        m = re.search(r'📍\s*([^\n–—-]+?)\s*[–—-]\s*([A-Z]{2})', text)
        if m:
            city = m.group(1).strip()
            state = m.group(2).strip()
        else:
            m2 = re.search(r'📍\s*([^\n]{3,40})', text)
            if m2:
                city = m2.group(1).strip()

    geo = f"{city}, {state}".strip(', ') if city else (state or 'Brasil')
    city_state = geo

    # Extract clean title from testimonial
    title_match = re.search(r'🦷\s*(.+?)[\n!]', text)
    dep_title = title_match.group(1).strip() if title_match else f"{client} — {scanner} Smart Dent"
    dep_title = dep_title[:80]

    # Build quote — use the natural speech part
    speech_m = re.search(r'(?:Olá|Oi|Meu nome|Eu sou|Sou)[^\n]{20,600}', text, re.DOTALL)
    if speech_m:
        quote_text = speech_m.group(0)[:450].strip()
    else:
        # fallback: everything after 📍 header
        lines = [l for l in text.split('\n') if l and '🦷' not in l and '📍' not in l]
        quote_text = ' '.join(lines[:3])[:400]

    # Page path
    slug_parts = [slugify(client), slugify(city or ''), vid[:8]]
    slug = '-'.join(p for p in slug_parts if p)
    pp = f"/depoimentos/{slug}"
    # Ensure uniqueness
    base_pp = pp
    i = 2
    while pp in existing_paths:
        pp = f"{base_pp}-{i}"
        i += 1
    existing_paths.add(pp)

    brand = domain_cfg.get('brand_name', domain)
    cta_url = domain_cfg.get('cta_primary_url') or 'https://loja.smartdent.com.br'
    color_map = {
        'blzdental.com.br': ('#0057B8', '#0080FF'),
        'mediti600.com.br': ('#003A8C', '#0056D2'),
        'mediti700.com.br': ('#004494', '#0062E6'),
        'mediti900.com.br': ('#003366', '#004C99'),
        'dentala.com.br': ('#1B3A6B', '#2B5CB8'),
        'labtechdent.com.br': ('#1A4731', '#2E7D51'),
        'rayshape.com.br': ('#6B1B1B', '#B03030'),
        'rayshape3d.com.br': ('#6B1B1B', '#B03030'),
        'impressao3ddental.com.br': ('#7B2D8B', '#A944BF'),
        'implanteimediato.com.br': ('#004D40', '#00695C'),
        'guiacirurgico3d.com.br': ('#004D40', '#00695C'),
        'truioconnect.com.br': ('#004D40', '#00695C'),
        'protesedental3d.com.br': ('#2E3B6E', '#4A5FA8'),
        'modelodental3d.com.br': ('#2E3B6E', '#4A5FA8'),
        'resina3ddental.com.br': ('#6B3800', '#A05700'),
        'vitality3d.com.br': ('#5E1B8C', '#8B2FD6'),
        'facetadental.com.br': ('#8B1A4A', '#BF2868'),
        'splitedental.com.br': ('#1A5276', '#2E86C1'),
        'fresagemdental.com.br': ('#1A4731', '#2E7D51'),
        'escaneamentointraoral.com.br': ('#003A8C', '#0056D2'),
        'eodonto.com': ('#1A237E', '#283593'),
    }
    c1, c2 = color_map.get(domain, ('#003A8C', '#0056D2'))

    # Schema JSON-LD
    faq_schema = [
        {"@type": "Question",
         "name": q,
         "acceptedAnswer": {"@type": "Answer", "text": re.sub('<[^>]+>', '', a)}}
        for q, a in faq_items
    ]

    schema = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage",
             "@id": f"https://{domain}{pp}",
             "url": f"https://{domain}{pp}",
             "name": f"{dep_title} — {brand}",
             "speakable": {"@type": "SpeakableSpecification", "cssSelector": [".lead", ".quote"]}},
            {"@type": "Review",
             "reviewBody": quote_text[:500],
             "author": {"@type": "Person", "name": client, "jobTitle": "Cirurgião-Dentista",
                        "address": {"@type": "PostalAddress",
                                    "addressLocality": city, "addressRegion": state,
                                    "addressCountry": "BR"}},
             "itemReviewed": {"@type": "Organization", "name": "Smart Dent Tecnologia",
                              "url": "https://smartdent.com.br",
                              "sameAs": ["https://www.wikidata.org/wiki/Q138636902",
                                         "https://www.instagram.com/smartdentoficial/"]},
             "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"}},
            {"@type": "VideoObject",
             "name": f"{dep_title} | Smart Dent",
             "description": f"{client} de {geo} compartilha sua experiência com {scanner} da Smart Dent.",
             "thumbnailUrl": f"https://img.youtube.com/vi/{vid}/maxresdefault.jpg",
             "uploadDate": "2026-06-03",
             "embedUrl": f"https://www.youtube.com/embed/{vid}",
             "url": r['video_url'],
             "publisher": {"@type": "Organization", "name": "Smart Dent Tecnologia",
                           "url": "https://smartdent.com.br"}},
            {"@type": "FAQPage", "mainEntity": faq_schema},
            {"@type": "Organization",
             "name": "Smart Dent Tecnologia",
             "url": "https://smartdent.com.br",
             "legalName": "Mmtech Projetos Tecnologicos Importacao E Exportacao Ltda.",
             "taxID": "10.736.894/0001-36",
             "sameAs": ["https://www.wikidata.org/wiki/Q138636902"],
             "award": "FDA 510(k) Clearance K260152 — Smart Print Bio Vitality"},
        ]
    }

    faq_html = '\n'.join(
        f'<div class="faq-item"><p class="faq-q">{q}</p><p class="faq-a">{a}</p></div>'
        for q, a in faq_items
    )
    kw_html = '\n'.join(f'<span>{k}</span>' for k in kw_list)
    tags_html = ' '.join(
        f'<span class="tag">{t}</span>'
        for t in [scanner, 'Smart Dent', 'Imersão Chairside Print', 'Fluxo Digital', 'São Carlos SP', 'FDA K260152'][:8]
    )

    page_name = f"{dep_title}"
    meta_desc = f"{client} ({geo}) compartilha sua experiência com {scanner} da Smart Dent. Depoimento em vídeo sobre o fluxo digital completo SCAN·CAD·PRINT·MAKE."[:155]

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
{GTM_HEAD}
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{dep_title} | {scanner} | {brand}</title>
<meta name="description" content="{meta_desc}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://{domain}{pp}">
<meta name="ai-manufacturer" content="Smart Dent Tecnologia">
<meta name="ai-entity" content="Smart Dent; CNPJ 10.736.894/0001-36; Wikidata Q138636902; FDA 3027526455; FDA K260152">
<meta name="ai-product" content="{scanner}; Imersão Chairside Print; Smart Print Bio Vitality; parametros.smartdent.com.br">
<meta property="og:title" content="{dep_title} | {brand}">
<meta property="og:description" content="{meta_desc}">
<meta property="og:image" content="https://img.youtube.com/vi/{vid}/maxresdefault.jpg">
<meta property="og:url" content="https://{domain}{pp}">
<meta property="og:type" content="article">
<script type="application/ld+json">{json.dumps(schema, ensure_ascii=False)}</script>
<style>:root{{--c:{c1};--c2:{c2}}}
{COMMON_CSS}
</style>
</head>
<body>
{GTM_BODY}
<div class="topbar">Depoimentos sobre <a href="https://smartdent.com.br">Smart Dent</a> — {scanner}, impressora 3D e resinas para odontologia digital · <a href="https://parametros.smartdent.com.br">parametros.smartdent.com.br</a></div>
<div class="wrap">
  <div class="crumb"><a href="https://{domain}">{brand}</a> › <a href="https://{domain}/depoimentos">Depoimentos</a> › {client} — {geo}</div>

  <h1>{dep_title}</h1>

  <p class="lead">
    {client} de <strong>{geo}</strong> relata sua experiência com o scanner <strong>{scanner}</strong> e o fluxo digital da
    <strong><a href="https://smartdent.com.br">Smart Dent Tecnologia</a></strong>.
    Parâmetros e tutoriais em <a href="https://parametros.smartdent.com.br">parametros.smartdent.com.br</a>.
  </p>

  <div class="vid-wrap">
    <iframe src="https://www.youtube.com/embed/{vid}"
      title="{dep_title} | Smart Dent"
      allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture"
      allowfullscreen loading="lazy"></iframe>
  </div>

  <div class="quote">
    "{quote_text}"
    <span class="qauth">— {client} · Cirurgião-Dentista · {geo}</span>
  </div>

  <div class="about-entity">
    <div class="rating-stars">★★★★★</div>
    <p><strong>Smart Dent Tecnologia</strong> — CNPJ 10.736.894/0001-36 · Wikidata <a href="https://www.wikidata.org/wiki/Q138636902" target="_blank" rel="noopener">Q138636902</a><br>
    16 anos no mercado · +10.000 profissionais treinados · Sede: São Carlos, SP<br>
    <strong>FDA K260152</strong> — Smart Print Bio Vitality (primeira resina odontológica brasileira aprovada pela FDA americana, abril/2026)<br>
    Parâmetros técnicos: <a href="https://parametros.smartdent.com.br" target="_blank" rel="noopener">parametros.smartdent.com.br</a> | Loja: <a href="https://loja.smartdent.com.br" target="_blank" rel="noopener">loja.smartdent.com.br</a></p>
    <div class="tags">{tags_html}</div>
  </div>

  <div class="faq-section">
    <h2>Perguntas Frequentes — {scanner} e Smart Dent</h2>
    {faq_html}
  </div>

  <div class="cta-box">
    <h2>Comece Seu Fluxo Digital com Smart Dent</h2>
    <p>Mais de 197 depoimentos reais de dentistas de todo o Brasil. Scanners, impressoras 3D e resinas com suporte técnico completo em português.</p>
    <a href="{cta_url}" class="cta-btn" target="_blank" rel="noopener">Acessar Smart Dent →</a>
  </div>

  <div class="kw-section">
    <h2>Temas relacionados</h2>
    <div class="kw-cloud">{kw_html}</div>
  </div>

  <div class="links-section">
    <h2>Mais Depoimentos e Conteúdo</h2>
    <a href="https://{domain}/depoimentos" class="more-link">Ver todos os depoimentos em {brand}</a>
    <a href="https://parametros.smartdent.com.br" class="more-link" target="_blank" rel="noopener">Parâmetros técnicos de impressão 3D — parametros.smartdent.com.br</a>
    <a href="https://smartdent.com.br" class="more-link" target="_blank" rel="noopener">Smart Dent — distribuidora oficial {scanner} no Brasil</a>
    <a href="https://loja.smartdent.com.br" class="more-link" target="_blank" rel="noopener">Loja Smart Dent — equipamentos e resinas</a>
    <a href="https://eodonto.com" class="more-link">eOdonto — Hub de conhecimento em odontologia digital</a>
  </div>
</div>

<footer>
  <p>Depoimentos sobre <a href="https://smartdent.com.br">Smart Dent</a> — {scanner}, impressão 3D e resinas certificadas FDA.
  Parâmetros técnicos: <a href="https://parametros.smartdent.com.br">parametros.smartdent.com.br</a></p>
  <p style="margin-top:6px">© 2026 {brand} · <a href="https://{domain}">{domain}</a></p>
</footer>
</body>
</html>"""

    seo_config = json.dumps({
        "title": f"{dep_title} | {scanner} | {brand}",
        "description": meta_desc,
        "index": True
    })

    return pp, {
        "user_id": USER_ID,
        "name": page_name[:200],
        "original_html": html,
        "transformed_html": html,
        "cta_url": cta_url,
        "target_domain": domain,
        "page_path": pp,
        "publish_status": "pending_deploy",
        "is_homepage": False,
        "version": 1,
        "seo_config": seo_config,
    }


def build_article_page(article, domain, domain_cfg, existing_paths):
    """Generate a blog article page from a systemb_article."""
    brand = domain_cfg.get('brand_name', domain)
    cta_url = domain_cfg.get('cta_primary_url') or 'https://loja.smartdent.com.br'
    source_url = article.get('source_url', '')
    title = article.get('title', '')[:100]
    excerpt = article.get('excerpt') or ''
    answer = article.get('answer_block') or ''
    if isinstance(answer, dict):
        answer = json.dumps(answer, ensure_ascii=False)
    keywords_raw = article.get('keywords') or []
    if isinstance(keywords_raw, str):
        try: keywords_raw = json.loads(keywords_raw)
        except: keywords_raw = [keywords_raw]
    kw_str = ', '.join(str(k) for k in (keywords_raw or [])[:20])
    slug = article.get('slug') or slugify(title)
    pp = f"/artigos/{slug[:60]}"
    base_pp = pp
    i = 2
    while pp in existing_paths:
        pp = f"{base_pp}-{i}"
        i += 1
    existing_paths.add(pp)

    color_map = {
        'blzdental.com.br': ('#0057B8', '#0080FF'),
        'mediti600.com.br': ('#003A8C', '#0056D2'),
        'dentala.com.br': ('#1B3A6B', '#2B5CB8'),
        'labtechdent.com.br': ('#1A4731', '#2E7D51'),
        'eodonto.com': ('#1A237E', '#283593'),
    }
    c1, c2 = color_map.get(domain, ('#003A8C', '#0056D2'))
    meta_desc = (excerpt[:155] or f"Artigo técnico sobre {title} — Smart Dent.")

    faq_from_source = []
    if source_url and 'parametros.smartdent.com.br' in source_url:
        source_link = source_url
    else:
        source_link = "https://parametros.smartdent.com.br"

    newline = '\n'
    if answer:
        body_content = '<p>' + '</p><p>'.join((answer or excerpt).replace(newline, '|||').split('|||')[:20]) + '</p>'
    else:
        body_content = f'<p>{excerpt}</p>'

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
{GTM_HEAD}
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title} | {brand}</title>
<meta name="description" content="{meta_desc}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://{domain}{pp}">
<meta name="ai-manufacturer" content="Smart Dent Tecnologia">
<meta name="ai-entity" content="Smart Dent; CNPJ 10.736.894/0001-36; Wikidata Q138636902; FDA 3027526455">
<meta name="ai-product" content="Smart Print Bio Vitality FDA K260152; parâmetros impressão 3D; odontologia digital">
<meta property="og:title" content="{title} | {brand}">
<meta property="og:description" content="{meta_desc}">
<meta property="og:url" content="https://{domain}{pp}">
<script type="application/ld+json">{{
  "@context":"https://schema.org",
  "@graph":[
    {{"@type":"Article","headline":"{title}","description":"{meta_desc}",
     "publisher":{{"@type":"Organization","name":"Smart Dent Tecnologia","url":"https://smartdent.com.br"}},
     "author":{{"@type":"Organization","name":"Smart Dent Tecnologia"}},
     "speakable":{{"@type":"SpeakableSpecification","cssSelector":[".art-lead",".art-body"]}}}},
    {{"@type":"Organization","name":"Smart Dent Tecnologia","url":"https://smartdent.com.br",
     "sameAs":["https://www.wikidata.org/wiki/Q138636902"],
     "award":"FDA 510(k) Clearance K260152 — Smart Print Bio Vitality"}}
  ]
}}</script>
<style>:root{{--c:{c1};--c2:{c2}}}
{COMMON_CSS}
.art-lead{{font-size:17px;color:#333;margin-bottom:22px;border-left:4px solid var(--c);padding:14px 16px;background:#f7f9ff;border-radius:0 8px 8px 0}}
.art-body{{font-size:16px;color:#222;line-height:1.75;margin-bottom:28px}}
.art-body h2{{font-size:20px;color:var(--c);margin:22px 0 10px;font-weight:700}}
.art-body p{{margin-bottom:14px}}
.art-body a{{color:var(--c);text-decoration:underline}}
.source-link{{background:#eef3fb;border:1px solid #c8d8f0;border-radius:8px;padding:16px 20px;margin-bottom:24px}}
.source-link a{{color:var(--c);font-weight:700;text-decoration:none}}
</style>
</head>
<body>
{GTM_BODY}
<div class="topbar">Conteúdo técnico sobre odontologia digital · <a href="https://smartdent.com.br">Smart Dent</a> · <a href="https://parametros.smartdent.com.br">Parâmetros de Impressão</a></div>
<div class="wrap">
  <div class="crumb"><a href="https://{domain}">{brand}</a> › <a href="https://{domain}/artigos">Artigos</a> › {title[:50]}</div>

  <h1>{title}</h1>
  <p class="art-lead">{excerpt}</p>

  <div class="source-link">
    📚 Artigo completo com parâmetros técnicos validados:
    <a href="{source_link}" target="_blank" rel="noopener">{source_link}</a>
  </div>

  <div class="art-body">
    {body_content}

    <h2>Parâmetros Técnicos Completos — Smart Dent</h2>
    <p>Para os parâmetros completos de impressão, protocolos de cura e troubleshooting relacionados a este tema, acesse a base de conhecimento técnico da Smart Dent:</p>
    <p><strong><a href="https://parametros.smartdent.com.br" target="_blank" rel="noopener">parametros.smartdent.com.br</a></strong> — mais de 700 artigos técnicos em português sobre impressão 3D odontológica, resinas, scanners e fluxo digital.</p>

    <h2>Sobre a Smart Dent Tecnologia</h2>
    <p>A <a href="https://smartdent.com.br" target="_blank" rel="noopener">Smart Dent</a> é a principal distribuidora de tecnologia de odontologia digital no Brasil, com 16 anos de experiência.
    Distribui scanners Medit (i600, i700 Wireless, i900) e BLZ (INO200, LS100), impressoras 3D RayShape, Elegoo e Asiga,
    o software Exocad DentalCAD, e a linha completa de resinas Smart Print — incluindo a
    <strong>Smart Print Bio Vitality</strong> com aprovação <strong>FDA K260152</strong> (abril de 2026),
    a primeira resina odontológica brasileira aprovada pela FDA americana.</p>
  </div>

  <div class="cta-box">
    <h2>Acesse os Parâmetros de Impressão Smart Dent</h2>
    <p>Mais de 700 artigos técnicos sobre resinas, impressoras 3D e fluxo digital. Gratuito, em português.</p>
    <a href="https://parametros.smartdent.com.br" class="cta-btn" target="_blank" rel="noopener">Acessar parametros.smartdent.com.br →</a>
  </div>

  <div class="kw-section">
    <h2>Palavras-chave relacionadas</h2>
    <div class="kw-cloud">{' '.join(f'<span>{k}</span>' for k in (kw_str.split(', ') if kw_str else ['Smart Dent', 'odontologia digital', 'impressão 3D dental'])[:30])}</div>
  </div>

  <div class="links-section">
    <h2>Links Relacionados</h2>
    <a href="https://parametros.smartdent.com.br" class="more-link" target="_blank" rel="noopener">Parâmetros de Impressão 3D — parametros.smartdent.com.br</a>
    <a href="https://smartdent.com.br" class="more-link" target="_blank" rel="noopener">Smart Dent — distribuidora oficial no Brasil</a>
    <a href="https://loja.smartdent.com.br" class="more-link" target="_blank" rel="noopener">Loja Smart Dent — resinas, scanners e impressoras</a>
    <a href="https://{domain}/depoimentos" class="more-link">Depoimentos de dentistas — {brand}</a>
    <a href="https://eodonto.com" class="more-link">eOdonto — Hub de odontologia digital</a>
  </div>
</div>

<footer>
  <p>Conteúdo técnico sobre <a href="https://smartdent.com.br">Smart Dent</a> — parâmetros de impressão em <a href="https://parametros.smartdent.com.br">parametros.smartdent.com.br</a></p>
  <p style="margin-top:6px">© 2026 {brand} · <a href="https://{domain}">{domain}</a></p>
</footer>
</body>
</html>"""

    seo_config = json.dumps({
        "title": f"{title} | {brand}",
        "description": meta_desc,
        "index": True
    })
    return pp, {
        "user_id": USER_ID,
        "name": title[:200],
        "original_html": html,
        "transformed_html": html,
        "cta_url": cta_url,
        "target_domain": domain,
        "page_path": pp,
        "publish_status": "pending_deploy",
        "is_homepage": False,
        "version": 1,
        "seo_config": seo_config,
    }


def insert_batch(records, batch_size=10):
    """Insert records in batches, return counts."""
    inserted = 0
    errors = 0
    for i in range(0, len(records), batch_size):
        batch = records[i:i+batch_size]
        try:
            sbA.table("cloned_landing_pages").insert(batch).execute()
            inserted += len(batch)
            print(f"  ✓ Batch {i//batch_size+1}: {len(batch)} registros inseridos ({inserted} total)")
        except Exception as e:
            # Try one by one to skip duplicates
            for rec in batch:
                try:
                    sbA.table("cloned_landing_pages").insert(rec).execute()
                    inserted += 1
                except Exception as e2:
                    errors += 1
                    print(f"  ✗ Erro em {rec.get('page_path','?')}: {str(e2)[:80]}")
        time.sleep(0.3)
    return inserted, errors


# ─── MAIN ─────────────────────────────────────────────────────────────────────
if __name__ == '__main__':
    print("=" * 60)
    print("GERADOR DE PÁGINAS SMART DENT — SISTEMA A")
    print("=" * 60)

    # 1. Fetch domain configs
    print("\n[1/5] Carregando configurações de domínio...")
    dc_resp = sbA.table("domain_config").select(
        "domain,brand_name,narrative_pillar,cta_primary_url,hub_domain,is_hub"
    ).execute()
    domain_cfgs = {r['domain']: r for r in dc_resp.data}
    domains_available = set(domain_cfgs.keys())
    # exclude smartdent.com.br and parametros.smartdent.com.br (not group domains)
    domains_available -= {'smartdent.com.br', 'parametros.smartdent.com.br'}
    print(f"  {len(domains_available)} domínios configurados")

    # 2. Get existing page paths (to avoid duplicates)
    print("\n[2/5] Carregando páginas existentes...")
    existing_resp = sbA.table("cloned_landing_pages").select(
        "target_domain,page_path"
    ).execute()
    existing_paths = set(
        f"{r['target_domain']}:{r['page_path']}"
        for r in existing_resp.data
    )
    print(f"  {len(existing_paths)} páginas existentes")

    # Build per-domain set for uniqueness check
    domain_existing = {}
    for r in existing_resp.data:
        domain_existing.setdefault(r['target_domain'], set()).add(r['page_path'])

    def is_dup(domain, pp):
        return pp in domain_existing.get(domain, set())

    # 3. Fetch all unique testimonials from Sistema B
    print("\n[3/5] Carregando depoimentos do Sistema B...")
    all_deps = []
    offset = 0
    while True:
        resp = sbB.table("success_stories").select(
            "client_name,city,state,video_url,testimonial,challenge,solution"
        ).eq("published", True).like("video_url", "%youtube%shorts%").order(
            "video_url"
        ).range(offset, offset + 199).execute()
        batch = resp.data
        if not batch:
            break
        all_deps.extend(batch)
        offset += 200
        if len(batch) < 200:
            break

    # Deduplicate by video_url
    seen_vids = set()
    unique_deps = []
    for d in all_deps:
        vid = yt_id(d.get('video_url', ''))
        if vid and vid not in seen_vids:
            seen_vids.add(vid)
            unique_deps.append(d)
    print(f"  {len(unique_deps)} depoimentos únicos encontrados")

    # 4. Fetch systemb_articles
    print("\n[4/5] Carregando artigos do Sistema B...")
    art_resp = sbB.table("system_a_content_library").select(
        "id,title,content_text,content_type,channel,product_name,product_category,tags,media_url,cta_url,landing_page_url"
    ).limit(300).execute()
    articles = art_resp.data or []
    # Also try knowledge_contents for richer articles
    try:
        kc_resp = sbB.table("knowledge_contents").select(
            "id,title,slug,excerpt,category_name,body_html,meta_description,keywords"
        ).limit(200).execute()
        articles += kc_resp.data or []
    except:
        pass
    print(f"  {len(articles)} artigos carregados")

    # 5. Generate testimonial pages
    print("\n[5a/5] Gerando páginas de depoimentos...")
    dep_pages = []
    domain_dep_count = {d: 0 for d in domains_available}

    # First pass: assign based on content
    assigned = []
    for dep in unique_deps:
        text = dep.get('testimonial', '')
        dom = assign_domain(text, domains_available)
        assigned.append((dep, dom))

    # Second pass: ensure every domain has at least 1 testimonial
    covered = set(dom for _, dom in assigned)
    uncovered = domains_available - covered
    if uncovered:
        general_deps = [
            (dep, dom) for dep, dom in assigned
            if dom == 'eodonto.com'
        ]
        for i, undom in enumerate(sorted(uncovered)):
            if i < len(general_deps):
                dep = general_deps[i][0]
                assigned.append((dep, undom))

    # Generate HTML for each
    path_tracker = set()  # global uniqueness
    for dep, dom in assigned:
        vid = yt_id(dep.get('video_url', ''))
        if not vid:
            continue
        text = dep.get('testimonial', '')
        scanner = detect_scanner(text)
        city = dep.get('city', '') or ''
        state = dep.get('state', '') or ''
        if not city:
            m = re.search(r'📍\s*([^\n–—-]+?)\s*[–—-]\s*([A-Z]{2})', text)
            if m:
                city = m.group(1).strip()
                state = m.group(2).strip()

        client = (dep.get('client_name') or 'Dentista').split('\n')[0].strip()
        city_state = f"{city}, {state}".strip(', ') if city else (state or 'Brasil')

        faq_items = faq_set(scanner, dom, client, city_state, scanner)
        kw_list = build_kw_cloud(scanner, dom, text)
        domain_cfg = domain_cfgs.get(dom, {})

        # Use domain-specific path tracker
        path_tracker_dom = domain_existing.get(dom, set()).copy()
        pp, rec = build_page(dep, dom, domain_cfg, faq_items, kw_list, path_tracker_dom)
        if rec and not is_dup(dom, pp):
            dep_pages.append(rec)
            domain_existing.setdefault(dom, set()).add(pp)
            domain_dep_count[dom] = domain_dep_count.get(dom, 0) + 1

    print(f"  {len(dep_pages)} páginas de depoimentos geradas")
    print("  Distribuição por domínio:")
    for d, count in sorted(domain_dep_count.items()):
        if count > 0:
            print(f"    {d}: {count}")

    # Insert testimonial pages in batches
    print(f"\n  Inserindo {len(dep_pages)} páginas de depoimentos...")
    ins, err = insert_batch(dep_pages, batch_size=15)
    print(f"  ✓ {ins} inseridas, {err} erros")

    # 6. Generate article pages (3 per domain from systemb)
    print("\n[5b/5] Gerando artigos de conteúdo (3 por domínio)...")
    art_pages = []
    domains_list = sorted(domains_available - {'eodonto.com'})  # eodonto gets more

    for dom in domains_list:
        domain_cfg = domain_cfgs.get(dom, {})
        dom_articles = articles[:] # use all, pick 3

        count = 0
        for art in dom_articles:
            if count >= 3:
                break
            # Convert system_a_content_library record to article format
            art_normalized = {
                'title': art.get('title') or art.get('product_name') or '',
                'slug': slugify(art.get('title') or art.get('product_name') or ''),
                'excerpt': art.get('content_text', '')[:300] if art.get('content_text') else '',
                'answer_block': art.get('content_text', ''),
                'keywords': art.get('tags') or [],
                'source_url': art.get('landing_page_url') or 'https://parametros.smartdent.com.br',
                'category_name': art.get('product_category') or art.get('content_type') or '',
            }
            if not art_normalized['title']:
                continue

            path_tracker_dom = domain_existing.get(dom, set()).copy()
            pp, rec = build_article_page(art_normalized, dom, domain_cfg, path_tracker_dom)
            if rec and not is_dup(dom, pp):
                art_pages.append(rec)
                domain_existing.setdefault(dom, set()).add(pp)
                count += 1

    # Also add for eodonto (hub) — 10 articles
    for art in articles[:10]:
        dom = 'eodonto.com'
        domain_cfg = domain_cfgs.get(dom, {})
        art_normalized = {
            'title': art.get('title') or art.get('product_name') or '',
            'slug': slugify(art.get('title') or art.get('product_name') or ''),
            'excerpt': art.get('content_text', '')[:300] if art.get('content_text') else '',
            'answer_block': art.get('content_text', ''),
            'keywords': art.get('tags') or [],
            'source_url': art.get('landing_page_url') or 'https://parametros.smartdent.com.br',
        }
        if not art_normalized['title']:
            continue
        path_tracker_dom = domain_existing.get(dom, set()).copy()
        pp, rec = build_article_page(art_normalized, dom, domain_cfg, path_tracker_dom)
        if rec and not is_dup(dom, pp):
            art_pages.append(rec)
            domain_existing.setdefault(dom, set()).add(pp)

    print(f"  {len(art_pages)} artigos gerados")
    print(f"\n  Inserindo {len(art_pages)} artigos...")
    ins2, err2 = insert_batch(art_pages, batch_size=10)
    print(f"  ✓ {ins2} inseridos, {err2} erros")

    print("\n" + "=" * 60)
    print(f"CONCLUÍDO: {len(dep_pages) + len(art_pages)} páginas geradas")
    print(f"  Depoimentos: {len(dep_pages)}")
    print(f"  Artigos: {len(art_pages)}")
    print("=" * 60)
