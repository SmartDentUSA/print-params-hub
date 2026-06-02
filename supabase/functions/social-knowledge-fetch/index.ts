import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ENDPOINT = 'https://pgfgripuanuwwolmtknn.supabase.co/functions/v1/knowledge-export-full';
const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { at: number; products: any[] } | null = null;

async function loadProducts(): Promise<any[]> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.products;
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ limit: 500 }),
  });
  if (!res.ok) {
    console.warn('[social-knowledge-fetch] endpoint status', res.status);
    return cache?.products ?? [];
  }
  const json = await res.json();
  const products = Array.isArray(json?.products) ? json.products : [];
  cache = { at: Date.now(), products };
  return products;
}

function matchProduct(products: any[], slug?: string, name?: string): any | null {
  if (slug) {
    const s = String(slug).trim().toLowerCase();
    const exact = products.find((p) => String(p?.slug || '').toLowerCase() === s);
    if (exact) return exact;
    const partial = products.find((p) => String(p?.slug || '').toLowerCase().includes(s) || s.includes(String(p?.slug || '').toLowerCase()));
    if (partial) return partial;
  }
  if (name) {
    const n = String(name).trim().toLowerCase();
    const byName = products.find((p) => String(p?.name || '').toLowerCase().includes(n) || n.includes(String(p?.name || '').toLowerCase()));
    if (byName) return byName;
  }
  return null;
}

function clean(s: any, max = 800): string {
  if (!s) return '';
  return String(s).replace(/\s+/g, ' ').replace(/<[^>]+>/g, ' ').trim().slice(0, max);
}

function buildReadyCopies(p: any) {
  const copies: Array<{ id: string; source: string; label: string; text: string }> = [];
  const msgs = p?.messages || {};

  for (const arr of [msgs.cs, msgs.aftersales]) {
    if (!Array.isArray(arr)) continue;
    arr
      .filter((m: any) => m?.is_active !== false && m?.message_content)
      .sort((a: any, b: any) => (a?.message_order ?? 0) - (b?.message_order ?? 0))
      .forEach((m: any, idx: number) => {
        const txt = clean(m.message_content, 2000);
        if (txt.length < 8 || /^digite sua mensagem/i.test(txt)) return;
        copies.push({
          id: String(m.id || `${arr === msgs.cs ? 'cs' : 'af'}-${idx}`),
          source: arr === msgs.cs ? 'cs' : 'aftersales',
          label: arr === msgs.cs ? `CS · msg ${m.message_order ?? idx + 1}` : `Pós-venda · msg ${m.message_order ?? idx + 1}`,
          text: txt,
        });
      });
  }

  const ads = p?.google_ads || {};
  const headlines: string[] = Array.isArray(ads.headlines) ? ads.headlines : [];
  const descs: string[] = Array.isArray(ads.descriptions) ? ads.descriptions : [];
  headlines.slice(0, 5).forEach((h: string, i: number) => {
    const t = clean(h, 200);
    if (t.length > 6) copies.push({ id: `ads-h-${i}`, source: 'google_ads', label: `Google Ads · headline ${i + 1}`, text: t });
  });
  descs.slice(0, 5).forEach((d: string, i: number) => {
    const t = clean(d, 400);
    if (t.length > 10) copies.push({ id: `ads-d-${i}`, source: 'google_ads', label: `Google Ads · descrição ${i + 1}`, text: t });
  });

  const seoDesc = clean(p?.seo?.seo_description, 400);
  if (seoDesc.length > 20) copies.push({ id: 'seo-desc', source: 'seo', label: 'SEO · descrição', text: seoDesc });

  return copies.slice(0, 12);
}

function buildEnrichment(p: any) {
  const videos = p?.videos || {};
  const pickVideos = (arr: any[]) =>
    (Array.isArray(arr) ? arr : []).slice(0, 3).map((v: any) => ({
      title: clean(v?.title, 160),
      url: v?.url || '',
      description: clean(v?.description, 400),
    }));

  return {
    name: p?.name,
    slug: p?.slug,
    category: p?.category,
    subcategory: p?.subcategory,
    description: clean(p?.description, 900),
    applications: clean(p?.applications, 500),
    benefits: Array.isArray(p?.benefits) ? p.benefits.slice(0, 8).map((x: any) => clean(x, 160)) : [],
    features: Array.isArray(p?.features) ? p.features.slice(0, 8).map((x: any) => clean(x, 160)) : [],
    keywords: Array.isArray(p?.keywords) ? p.keywords.slice(0, 15) : [],
    target_audience: clean(p?.target_audience, 300),
    tags: Array.isArray(p?.tags) ? p.tags.slice(0, 10) : [],
    faq_top: Array.isArray(p?.faq)
      ? p.faq.slice(0, 3).map((f: any) => ({ q: clean(f?.question, 200), a: clean(f?.answer, 400) }))
      : [],
    videos_top: {
      youtube: pickVideos(videos.youtube),
      instagram: pickVideos(videos.instagram),
      tiktok: pickVideos(videos.tiktok),
    },
    product_url: p?.ctas?.product_url || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const slug: string | undefined = body?.product_slug;
    const name: string | undefined = body?.product_name;
    if (!slug && !name) {
      return new Response(JSON.stringify({ error: 'Informe product_slug ou product_name.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const products = await loadProducts();
    const p = matchProduct(products, slug, name);
    if (!p) {
      return new Response(
        JSON.stringify({ product: null, ready_copies: [], enrichment: null, matched: false }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        matched: true,
        product: { name: p.name, slug: p.slug, category: p.category, url: p?.ctas?.product_url || null },
        ready_copies: buildReadyCopies(p),
        enrichment: buildEnrichment(p),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    console.error('[social-knowledge-fetch]', (e as Error).message);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});