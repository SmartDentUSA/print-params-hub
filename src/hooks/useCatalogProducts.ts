import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface CatalogProductLink {
  name: string;
  slug: string;
  shopUrl: string;
}

export function useCatalogProducts() {
  const [products, setProducts] = useState<Map<string, CatalogProductLink>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from('system_a_catalog')
        .select('id, name, slug')
        .eq('active', true)
        .eq('approved', true);

      if (data && !error) {
        const productMap = new Map<string, CatalogProductLink>();
        data.forEach(product => {
          // Normalizar nome para busca case-insensitive
          const normalizedName = product.name.toLowerCase();
          productMap.set(normalizedName, {
            name: product.name,
            slug: product.slug || '',
            shopUrl: product.slug || ''
          });
        });
        setProducts(productMap);
      }
      setLoading(false);
    }

    fetchProducts();
  }, []);

  return { products, loading };
}
