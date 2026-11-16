// Fonte única dos nós schema.org/Product da home institucional (React + HTML de crawlers).
// Canônico/URL = loja (canonical_url validado ao vivo); nunca cta_1_url (tinha 404).
const REST = 'https://okeogjgqijbfkudfjadz.supabase.co/rest/v1/system_a_catalog';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rZW9namdxaWpiZmt1ZGZqYWR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4NzE5MDgsImV4cCI6MjA3MjQ0NzkwOH0.OGdtvsJNdEqAfUoDA4O9OcnD69Titu69TsXS38TaVtk';
const COLS = 'name,slug,description,meta_description,image_url,og_image_url,price,promo_price,currency,cta_1_url,canonical_url,extra_data';

export interface SchemaProduct {
  name: string; slug: string; description?: string | null; meta_description?: string | null;
  image_url?: string | null; og_image_url?: string | null; price: number; promo_price?: number | null;
  currency?: string | null; cta_1_url?: string | null; canonical_url?: string | null;
  extra_data?: { brand?: string; sku?: string } | null;
}

/** Mesmo filtro comercial da ProductPage. ponytail: 24 itens; priorizar/paginar se o catálogo crescer. */
export async function fetchSchemaProducts(limit = 24): Promise<SchemaProduct[]> {
  const q = `select=${COLS}&category=eq.product&active=eq.true&approved=eq.true&visible_in_ui=eq.true&price=gt.0&order=name&limit=${limit}`;
  const res = await fetch(`${REST}?${q}`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
  if (!res.ok) throw new Error(`products schema: HTTP ${res.status}`);
  return res.json();
}

export function productNode(pr: SchemaProduct, site: string, orgId: string) {
  const url = pr.canonical_url || pr.cta_1_url || `${site}/produtos/${pr.slug}`;
  return {
    '@type': 'Product', '@id': `${url}#product`, name: pr.name, url,
    description: pr.meta_description || pr.description || pr.name,
    image: pr.og_image_url || pr.image_url || undefined,
    brand: { '@type': 'Brand', name: pr.extra_data?.brand || 'Smart Dent' },
    sku: pr.extra_data?.sku || undefined,
    offers: { '@type': 'Offer', priceCurrency: pr.currency || 'BRL', price: pr.promo_price ?? pr.price, url, seller: { '@id': orgId } },
  };
}
