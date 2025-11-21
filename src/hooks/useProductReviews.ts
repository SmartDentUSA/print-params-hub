import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ProductReview {
  id: string;
  name: string;
  external_id: string;
  image_url: string | null;
  price: number | null;
  currency: string | null;
  rating: number | null;
  category: string;
  product_category: string | null;
  product_subcategory: string | null;
}

export function useProductReviews(productIds: string[] = []) {
  const [products, setProducts] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!productIds || productIds.length === 0) {
      setProducts([]);
      return;
    }

    const fetchProducts = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('system_a_catalog')
          .select('id, name, external_id, image_url, price, currency, rating, category, product_category, product_subcategory')
          .in('id', productIds)
          .eq('active', true)
          .eq('approved', true);

        if (error) throw error;
        setProducts(data || []);
      } catch (error) {
        console.error('Error fetching products for reviews:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [productIds.join(',')]);

  return { products, loading };
}
