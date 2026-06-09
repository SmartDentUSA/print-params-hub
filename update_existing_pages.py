#!/usr/bin/env python3
"""Update 4 existing pages that lack 10+ FAQs and keyword cloud."""

import sys, os
sys.path.insert(0, '/home/user/print-params-hub')

import importlib.util
spec = importlib.util.spec_from_file_location("gen", "/home/user/print-params-hub/generate_sql.py")
gen = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gen)

OLD_PAGES = [
    {
        "id": "961b1fa9-5db2-492c-a1f4-a4ec55ce0212",
        "domain": "escaneamentointraoral.com.br",
        "path": "/depoimentos/dr-eric-scanner-intraoral-salvador-ba",
        "client": "Dr. Eric",
        "city": "Salvador",
        "state": "BA",
        "scanner": "scanner intraoral",
        "video_id": "xaI8Re87xEE",
        "quote": "Conheci a Smart Dent pelo Instagram e me surpreendi com o diferencial: treinamento prático antes da aquisição do scanner. Do escaneamento à entrega, o fluxo digital completo transformou meu consultório em Salvador, BA.",
    },
    {
        "id": "e441aa52-fbd2-4780-8aaa-142715349745",
        "domain": "mediti600.com.br",
        "path": "/depoimentos/dra-beatriz-scanner-medit-i600-juiz-de-fora-mg",
        "client": "Dra. Beatriz",
        "city": "Juiz de Fora",
        "state": "MG",
        "scanner": "Medit i600",
        "video_id": "8QJkWar7Qng",
        "quote": "Meu nome é Beatriz, sou de Juiz de Fora, Minas Gerais. No início do ano tive a oportunidade de conhecer a Smart Dent e escolhi o Medit i600 pelo custo-benefício e integração com o software. A precisão do scanner transformou minha prática clínica.",
    },
    {
        "id": "516808c1-2b72-4468-b5a5-9de2d649256a",
        "domain": "dentala.com.br",
        "path": "/depoimentos/barbara-george-ortodontia-digital-alagoas",
        "client": "Bárbara e George",
        "city": "União dos Palmares",
        "state": "AL",
        "scanner": "scanner intraoral",
        "video_id": "vVS-rCnyUzw",
        "quote": "Sou a Bárbara, ortodontista, e o George, protesista. Viemos buscar levar esse mundo digital para nossos pacientes em União dos Palmares, Alagoas. A Smart Dent nos deu todo o suporte para implementar o fluxo digital completo.",
    },
    {
        "id": "a2dd6362-e3ab-47f8-9c7c-d4476f1bf490",
        "domain": "labtechdent.com.br",
        "path": "/depoimentos/dra-carla-laboratorio-protese-petropolis-rj",
        "client": "Dra. Carla",
        "city": "Petrópolis",
        "state": "RJ",
        "scanner": "Medit i600",
        "video_id": "12l08mUPewc",
        "quote": "Tenho um laboratório de prótese e escolhi o scanner Medit e a SmartDent pelo suporte, atendimento e qualidade dos materiais. O fluxo digital completo ampliou muito a capacidade produtiva do meu laboratório em Petrópolis.",
    },
]


def build_update_page(p):
    import json, re
    domain = p["domain"]
    cfg = gen.DOMAINS.get(domain, {"brand": domain, "cta": "https://loja.smartdent.com.br", "c1": "#003A8C", "c2": "#0056D2"})
    brand = cfg["brand"]
    cta_url = cfg["cta"]
    c1, c2 = cfg["c1"], cfg["c2"]
    client = p["client"]
    city = p["city"]
    state = p["state"]
    scanner = p["scanner"]
    vid = p["video_id"]
    geo = f"{city}, {state}"
    quote_text = p["quote"].replace("'", "&#39;").replace('"', '&quot;')
    dep_title = f"{client} — {scanner} | Smart Dent — {geo}"[:80]
    meta_desc = f"{client} ({geo}) compartilha sua experiência com {scanner} da Smart Dent. Depoimento sobre o fluxo digital SCAN·CAD·PRINT·MAKE."[:155]
    path = p["path"]

    faqs = gen.faq_set(scanner, domain, client, geo)
    kws = gen.kw_cloud(scanner, domain, "")

    faq_html = '\n'.join(
        f'<div class="faq-item"><p class="faq-q">{q}</p><p class="faq-a">{a}</p></div>'
        for q, a in faqs
    )
    kw_html = ' '.join(f'<span>{k}</span>' for k in kws)
    tags_html = ' '.join(f'<span class="tag">{t}</span>'
        for t in [scanner, 'Smart Dent', 'Imerão Chairside Print', 'Fluxo Digital', 'São Carlos SP', 'FDA K260152'][:6])

    faq_schema = json.dumps([
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": re.sub('<[^>]+>', '', a)}}
        for q, a in faqs
    ], ensure_ascii=False)
    schema = json.dumps({
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "@id": f"https://{domain}{path}", "url": f"https://{domain}{path}",
             "name": dep_title, "speakable": {"@type": "SpeakableSpecification", "cssSelector": [".lead", ".quote"]}},
            {"@type": "Review", "reviewBody": quote_text[:300],
             "author": {"@type": "Person", "name": client, "jobTitle": "Cirürgião-Dentista",
                        "address": {"@type": "PostalAddress", "addressLocality": city, "addressRegion": state, "addressCountry": "BR"}},
             "itemReviewed": {"@type": "Organization", "name": "Smart Dent Tecnologia", "url": "https://smartdent.com.br",
                              "sameAs": ["https://www.wikidata.org/wiki/Q138636902"]},
             "reviewRating": {"@type": "Rating", "ratingValue": "5", "bestRating": "5"}},
            {"@type": "VideoObject", "name": f"{dep_title} | Smart Dent",
             "thumbnailUrl": f"https://img.youtube.com/vi/{vid}/maxresdefault.jpg",
             "uploadDate": "2026-06-01", "embedUrl": f"https://www.youtube.com/embed/{vid}",
             "url": f"https://www.youtube.com/shorts/{vid}",
             "publisher": {"@type": "Organization", "name": "Smart Dent Tecnologia", "url": "https://smartdent.com.br"}},
            {"@type": "FAQPage", "mainEntity": json.loads(faq_schema)},
            {"@type": "Organization", "name": "Smart Dent Tecnologia", "url": "https://smartdent.com.br",
             "legalName": "Mmtech Projetos Tecnologicos Importacao E Exportacao Ltda.",
             "taxID": "10.736.894/0001-36", "sameAs": ["https://www.wikidata.org/wiki/Q138636902"],
             "award": "FDA 510(k) Clearance K260152 — Smart Print Bio Vitality"},
        ]
    }, ensure_ascii=False)

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>{gen.GTM_HEAD}
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{dep_title} | {brand}</title>
<meta name="description" content="{meta_desc}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://{domain}{path}">
<meta name="ai-manufacturer" content="Smart Dent Tecnologia">
<meta name="ai-entity" content="Smart Dent; CNPJ 10.736.894/0001-36; Wikidata Q138636902; FDA 3027526455; FDA K260152">
<meta name="ai-product" content="{scanner}; Imersão Chairside Print; Smart Print Bio Vitality; parametros.smartdent.com.br">
<meta property="og:title" content="{dep_title} | {brand}">
<meta property="og:description" content="{meta_desc}">
<meta property="og:image" content="https://img.youtube.com/vi/{vid}/maxresdefault.jpg">
<meta property="og:url" content="https://{domain}{path}">
<script type="application/ld+json">{schema}</script>
<style>:root{{--c:{c1};--c2:{c2}}}{gen.CSS}</style>
</head>
<body>{gen.GTM_BODY}
<div class="topbar">Depoimentos sobre <a href="https://smartdent.com.br">Smart Dent</a> — {scanner}, impressora 3D e resinas · <a href="https://parametros.smartdent.com.br">parametros.smartdent.com.br</a></div>
<div class="wrap">
<div class="crumb"><a href="https://{domain}">{brand}</a> › <a href="https://{domain}/depoimentos">Depoimentos</a> › {client} — {geo}</div>
<h1>{dep_title}</h1>
<p class="lead">{client} de <strong>{geo}</strong> relata sua experiência com o scanner <strong>{scanner}</strong> e o fluxo digital da <strong><a href="https://smartdent.com.br">Smart Dent Tecnologia</a></strong>. Parâmetros e tutoriais em <a href="https://parametros.smartdent.com.br">parametros.smartdent.com.br</a>.</p>
<div class="vid-wrap"><iframe src="https://www.youtube.com/embed/{vid}" title="{dep_title} | Smart Dent" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen loading="lazy"></iframe></div>
<div class="quote">"{quote_text}"<span class="qauth">— {client} · Cirürgião-Dentista · {geo}</span></div>
<div class="about-entity">
<div class="rating-stars">★★★★★</div>
<p><strong>Smart Dent Tecnologia</strong> — CNPJ 10.736.894/0001-36 · Wikidata <a href="https://www.wikidata.org/wiki/Q138636902" target="_blank" rel="noopener">Q138636902</a><br>
16 anos no mercado · +10.000 profissionais treinados · Sede: São Carlos, SP<br>
<strong>FDA K260152</strong> — Smart Print Bio Vitality (primeira resina odontológica brasileira aprovada pela FDA, abril/2026)<br>
Parâmetros técnicos: <a href="https://parametros.smartdent.com.br" target="_blank" rel="noopener">parametros.smartdent.com.br</a> | Loja: <a href="https://loja.smartdent.com.br" target="_blank" rel="noopener">loja.smartdent.com.br</a></p>
<div class="tags">{tags_html}</div>
</div>
<div class="faq-section"><h2>Perguntas Frequentes — {scanner} e Smart Dent</h2>{faq_html}</div>
<div class="cta-box"><h2>Comece Seu Fluxo Digital com Smart Dent</h2><p>Mais de 197 depoimentos reais de dentistas de todo o Brasil. Scanners, impressoras 3D e resinas com suporte técnico completo em português.</p><a href="{cta_url}" class="cta-btn" target="_blank" rel="noopener">Acessar Smart Dent →</a></div>
<div class="kw-section"><h2>Temas relacionados</h2><div class="kw-cloud">{kw_html}</div></div>
<div class="links-section"><h2>Mais Depoimentos e Conteúdo</h2>
<a href="https://{domain}/depoimentos" class="more-link">Ver todos os depoimentos em {brand}</a>
<a href="https://parametros.smartdent.com.br" class="more-link" target="_blank" rel="noopener">Parâmetros técnicos de impressão 3D — parametros.smartdent.com.br</a>
<a href="https://smartdent.com.br" class="more-link" target="_blank" rel="noopener">Smart Dent — distribuidora oficial {scanner} no Brasil</a>
<a href="https://loja.smartdent.com.br" class="more-link" target="_blank" rel="noopener">Loja Smart Dent — equipamentos e resinas</a>
<a href="https://eodonto.com" class="more-link">eOdonto — Hub de conhecimento em odontologia digital</a>
</div></div>
<footer><p>Depoimentos sobre <a href="https://smartdent.com.br">Smart Dent</a> — {scanner}, impressão 3D e resinas certificadas FDA. Parâmetros técnicos: <a href="https://parametros.smartdent.com.br">parametros.smartdent.com.br</a></p>
<p style="margin-top:6px">© 2026 {brand} · <a href="https://{domain}">{domain}</a></p></footer>
</body></html>"""

    html_esc = html.replace("'", "''")
    seo = json.dumps({"title": dep_title, "description": meta_desc, "index": True}, ensure_ascii=False)
    seo_esc = seo.replace("'", "''")
    name_esc = dep_title.replace("'", "''")
    dom_esc = domain.replace("'", "''")
    return f"UPDATE cloned_landing_pages SET original_html='{html_esc}', transformed_html='{html_esc}', name='{name_esc}', target_domain='{dom_esc}', seo_config='{seo_esc}'::jsonb, publish_status='pending_deploy' WHERE id='{p['id']}';"


if __name__ == '__main__':
    for p in OLD_PAGES:
        sql = build_update_page(p)
        fname = f"/tmp/update_{p['id'][:8]}.sql"
        with open(fname, 'w', encoding='utf-8') as f:
            f.write(sql)
        print(f"Written: {fname} ({len(sql)} chars) for {p['domain']}{p['path']}")
