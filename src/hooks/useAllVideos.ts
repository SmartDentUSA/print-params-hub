import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export type VideoContentType = 
  | 'institucional' 
  | 'comercial' 
  | 'tecnico' 
  | 'passo_a_passo' 
  | 'educacional' 
  | 'depoimentos' 
  | 'cases_sucesso' 
  | 'lives'
  | null;

export const VIDEO_CONTENT_TYPES: { value: VideoContentType; label: string }[] = [
  { value: null, label: 'Não classificado' },
  { value: 'institucional', label: 'Institucional' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'tecnico', label: 'Técnico' },
  { value: 'passo_a_passo', label: 'Passo a Passo' },
  { value: 'educacional', label: 'Educacional' },
  { value: 'depoimentos', label: 'Depoimentos' },
  { value: 'cases_sucesso', label: 'Cases de Sucesso' },
  { value: 'lives', label: 'Lives' },
];

export interface VideoWithDetails {
  id: string;
  title: string;
  thumbnail_url: string | null;
  embed_url: string | null;
  content_type: VideoContentType;
  product_id: string | null;
  product_name: string | null;
  product_category: string | null;
  product_subcategory: string | null;
  resin_id: string | null;
  resin_name: string | null;
  content_id: string | null;
  content_title: string | null;
  analytics_views: number;
  analytics_play_rate: number;
  created_at: string;
  updated_at: string | null;
  has_transcript: boolean;
  video_transcript: string | null;
}

export interface ProductOption {
  id: string;
  name: string;
}

interface UseAllVideosOptions {
  pageSize?: number;
}

export function useAllVideos(options: UseAllVideosOptions = {}) {
  const { pageSize = 50 } = options;
  
  const [videos, setVideos] = useState<VideoWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<VideoContentType | 'all'>('all');
  const [linkStatusFilter, setLinkStatusFilter] = useState<'all' | 'with_product' | 'without_product' | 'with_article' | 'without_article'>('all');
  const [saving, setSaving] = useState(false);

  // Options lists
  const [categories, setCategories] = useState<string[]>([]);
  const [subcategories, setSubcategories] = useState<string[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);

  // Fetch options lists on mount
  useEffect(() => {
    const fetchOptions = async () => {
      // Fetch unique categories
      const { data: catsData } = await supabase
        .from('knowledge_videos')
        .select('product_category')
        .not('product_category', 'is', null);
      
      if (catsData) {
        const uniqueCats = [...new Set(catsData.map(c => c.product_category).filter(Boolean))] as string[];
        setCategories(uniqueCats.sort());
      }

      // Fetch unique subcategories
      const { data: subsData } = await supabase
        .from('knowledge_videos')
        .select('product_subcategory')
        .not('product_subcategory', 'is', null);
      
      if (subsData) {
        const uniqueSubs = [...new Set(subsData.map(s => s.product_subcategory).filter(Boolean))] as string[];
        setSubcategories(uniqueSubs.sort());
      }

      // Fetch products
      const { data: prodsData } = await supabase
        .from('system_a_catalog')
        .select('id, name')
        .eq('active', true)
        .eq('approved', true)
        .order('name');
      
      if (prodsData) {
        setProducts(prodsData);
      }
    };

    fetchOptions();
  }, []);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      // First get total count with filters
      let countQuery = supabase
        .from('knowledge_videos')
        .select('id', { count: 'exact', head: true })
        .eq('video_type', 'pandavideo');

      if (searchTerm) {
        countQuery = countQuery.ilike('title', `%${searchTerm}%`);
      }
      if (contentTypeFilter !== 'all') {
        if (contentTypeFilter === null) {
          countQuery = countQuery.is('content_type', null);
        } else {
          countQuery = countQuery.eq('content_type', contentTypeFilter);
        }
      }
      if (linkStatusFilter === 'with_product') {
        countQuery = countQuery.not('product_id', 'is', null);
      } else if (linkStatusFilter === 'without_product') {
        countQuery = countQuery.is('product_id', null);
      } else if (linkStatusFilter === 'with_article') {
        countQuery = countQuery.not('content_id', 'is', null);
      } else if (linkStatusFilter === 'without_article') {
        countQuery = countQuery.is('content_id', null);
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Now fetch videos with pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let query = supabase
        .from('knowledge_videos')
        .select(`
          id,
          title,
          thumbnail_url,
          embed_url,
          content_type,
          product_id,
          product_category,
          product_subcategory,
          resin_id,
          content_id,
          analytics_views,
          analytics_play_rate,
          created_at,
          updated_at,
          video_transcript
        `)
        .eq('video_type', 'pandavideo')
        .order('title', { ascending: true })
        .range(from, to);

      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }
      if (contentTypeFilter !== 'all') {
        if (contentTypeFilter === null) {
          query = query.is('content_type', null);
        } else {
          query = query.eq('content_type', contentTypeFilter);
        }
      }
      if (linkStatusFilter === 'with_product') {
        query = query.not('product_id', 'is', null);
      } else if (linkStatusFilter === 'without_product') {
        query = query.is('product_id', null);
      } else if (linkStatusFilter === 'with_article') {
        query = query.not('content_id', 'is', null);
      } else if (linkStatusFilter === 'without_article') {
        query = query.is('content_id', null);
      }

      const { data: videosData, error } = await query;

      if (error) throw error;

      // Fetch related data for products, resins, and contents
      const productIds = videosData?.filter(v => v.product_id).map(v => v.product_id) || [];
      const resinIds = videosData?.filter(v => v.resin_id).map(v => v.resin_id) || [];
      const contentIds = videosData?.filter(v => v.content_id).map(v => v.content_id) || [];

      const [productsRes, resinsRes, contentsRes] = await Promise.all([
        productIds.length > 0 
          ? supabase.from('system_a_catalog').select('id, name').in('id', productIds)
          : { data: [] },
        resinIds.length > 0
          ? supabase.from('resins').select('id, name').in('id', resinIds)
          : { data: [] },
        contentIds.length > 0
          ? supabase.from('knowledge_contents').select('id, title').in('id', contentIds)
          : { data: [] },
      ]);

      const productsMap = new Map((productsRes.data || []).map(p => [p.id, p.name]));
      const resinsMap = new Map((resinsRes.data || []).map(r => [r.id, r.name]));
      const contentsMap = new Map((contentsRes.data || []).map(c => [c.id, c.title]));

      const enrichedVideos: VideoWithDetails[] = (videosData || []).map(video => ({
        id: video.id,
        title: video.title,
        thumbnail_url: video.thumbnail_url,
        embed_url: video.embed_url,
        content_type: video.content_type as VideoContentType,
        product_id: video.product_id,
        product_name: video.product_id ? productsMap.get(video.product_id) || null : null,
        product_category: video.product_category,
        product_subcategory: video.product_subcategory,
        resin_id: video.resin_id,
        resin_name: video.resin_id ? resinsMap.get(video.resin_id) || null : null,
        content_id: video.content_id,
        content_title: video.content_id ? contentsMap.get(video.content_id) || null : null,
        analytics_views: video.analytics_views || 0,
        analytics_play_rate: video.analytics_play_rate || 0,
        created_at: video.created_at,
        updated_at: video.updated_at,
        has_transcript: !!video.video_transcript,
        video_transcript: video.video_transcript,
      }));

      setVideos(enrichedVideos);
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, searchTerm, contentTypeFilter, linkStatusFilter]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, contentTypeFilter, linkStatusFilter]);

  const updateContentType = async (videoId: string, contentType: VideoContentType) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('knowledge_videos')
        .update({ content_type: contentType })
        .eq('id', videoId);

      if (error) throw error;

      setVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, content_type: contentType } : v
      ));
      return true;
    } catch (error) {
      console.error('Error updating content type:', error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const updateVideoContentLink = async (videoId: string, contentId: string | null) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('knowledge_videos')
        .update({ content_id: contentId })
        .eq('id', videoId);

      if (error) throw error;

      // Fetch content title if linking
      let contentTitle = null;
      if (contentId) {
        const { data } = await supabase
          .from('knowledge_contents')
          .select('title')
          .eq('id', contentId)
          .single();
        contentTitle = data?.title || null;
      }

      setVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, content_id: contentId, content_title: contentTitle } : v
      ));
      return true;
    } catch (error) {
      console.error('Error updating content link:', error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Batch update function for multiple fields
  const updateVideoFields = async (
    videoId: string, 
    updates: {
      content_type?: VideoContentType;
      product_category?: string | null;
      product_subcategory?: string | null;
      product_id?: string | null;
      title?: string;
    }
  ) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('knowledge_videos')
        .update(updates)
        .eq('id', videoId);

      if (error) throw error;

      // Get product name if product_id was updated
      let productName = null;
      if (updates.product_id) {
        const product = products.find(p => p.id === updates.product_id);
        productName = product?.name || null;
      }

      setVideos(prev => prev.map(v => {
        if (v.id !== videoId) return v;
        return {
          ...v,
          ...(updates.content_type !== undefined && { content_type: updates.content_type }),
          ...(updates.product_category !== undefined && { product_category: updates.product_category }),
          ...(updates.product_subcategory !== undefined && { product_subcategory: updates.product_subcategory }),
          ...(updates.product_id !== undefined && { product_id: updates.product_id, product_name: productName }),
          ...(updates.title !== undefined && { title: updates.title }),
        };
      }));
      return true;
    } catch (error) {
      console.error('Error updating video fields:', error);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    videos,
    loading,
    saving,
    totalCount,
    currentPage,
    totalPages,
    searchTerm,
    contentTypeFilter,
    linkStatusFilter,
    categories,
    subcategories,
    products,
    setCurrentPage,
    setSearchTerm,
    setContentTypeFilter,
    setLinkStatusFilter,
    updateContentType,
    updateVideoContentLink,
    updateVideoFields,
    refetch: fetchVideos,
  };
}
