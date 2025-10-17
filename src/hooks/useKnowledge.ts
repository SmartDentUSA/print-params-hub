import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface KnowledgeCategory {
  id: string;
  name: string;
  letter: 'A' | 'B' | 'C' | 'D';
  enabled: boolean;
  order_index: number;
}

export interface KnowledgeContent {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  icon_color: string;
  file_url?: string;
  file_name?: string;
  meta_description?: string;
  og_image_url?: string;
  keywords?: string[];
  order_index: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeVideo {
  id: string;
  content_id: string;
  title: string;
  url: string;
  order_index: number;
}

export function useKnowledge() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // ===== FETCH =====
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('knowledge_categories')
        .select('*')
        .order('order_index');
      
      if (error) throw error;
      return data as KnowledgeCategory[];
    } catch (error) {
      toast({ title: 'Erro ao carregar categorias', variant: 'destructive' });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchContentsByCategory = async (categoryLetter: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('knowledge_contents')
        .select('*, knowledge_categories!inner(*), authors(*)')
        .eq('knowledge_categories.letter', categoryLetter.toUpperCase())
        .eq('active', true)
        .order('order_index');
      
      if (error) throw error;
      return data as any[];
    } catch (error) {
      toast({ title: 'Erro ao carregar conteúdos', variant: 'destructive' });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchContentBySlug = async (slug: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('knowledge_contents')
        .select('*, knowledge_categories(*), authors(*)')
        .eq('slug', slug)
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      toast({ title: 'Erro ao carregar conteúdo', variant: 'destructive' });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const fetchVideosByContent = async (contentId: string) => {
    try {
      const { data, error } = await supabase
        .from('knowledge_videos')
        .select('*')
        .eq('content_id', contentId)
        .order('order_index');
      
      if (error) throw error;
      return data as KnowledgeVideo[];
    } catch (error) {
      toast({ title: 'Erro ao carregar vídeos', variant: 'destructive' });
      return [];
    }
  };

  // ===== ADMIN CRUD =====
  const updateCategory = async (id: string, updates: Partial<KnowledgeCategory>) => {
    try {
      const { data, error } = await supabase
        .from('knowledge_categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      toast({ title: 'Categoria atualizada!' });
      return data;
    } catch (error) {
      toast({ title: 'Erro ao atualizar categoria', variant: 'destructive' });
      return null;
    }
  };

  const insertContent = async (content: Omit<KnowledgeContent, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('knowledge_contents')
        .insert(content)
        .select()
        .single();
      
      if (error) throw error;
      toast({ title: 'Conteúdo criado!' });
      return data;
    } catch (error) {
      toast({ title: 'Erro ao criar conteúdo', variant: 'destructive' });
      return null;
    }
  };

  const updateContent = async (id: string, updates: Partial<KnowledgeContent>) => {
    try {
      const { data, error } = await supabase
        .from('knowledge_contents')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      toast({ title: 'Conteúdo atualizado!' });
      return data;
    } catch (error) {
      toast({ title: 'Erro ao atualizar conteúdo', variant: 'destructive' });
      return null;
    }
  };

  const deleteContent = async (id: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_contents')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: 'Conteúdo excluído!' });
      return true;
    } catch (error) {
      toast({ title: 'Erro ao excluir conteúdo', variant: 'destructive' });
      return false;
    }
  };

  const insertVideo = async (video: Omit<KnowledgeVideo, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('knowledge_videos')
        .insert(video)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      toast({ title: 'Erro ao adicionar vídeo', variant: 'destructive' });
      return null;
    }
  };

  const deleteVideo = async (id: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_videos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (error) {
      toast({ title: 'Erro ao excluir vídeo', variant: 'destructive' });
      return false;
    }
  };

  const fetchRelatedContents = async (
    contentId: string, 
    categoryId: string | null, 
    keywords: string[] = [], 
    limit: number = 3
  ) => {
    try {
      // Prioridade 1: Mesma categoria, excluindo o artigo atual
      let query = supabase
        .from('knowledge_contents')
        .select('*, knowledge_categories(*)')
        .eq('active', true)
        .neq('id', contentId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      
      // Se encontrou artigos suficientes na mesma categoria, retorna
      if (data && data.length >= limit) {
        return data;
      }

      // Fallback: buscar artigos de outras categorias mais recentes
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('knowledge_contents')
        .select('*, knowledge_categories(*)')
        .eq('active', true)
        .neq('id', contentId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (fallbackError) throw fallbackError;
      return fallbackData || [];
    } catch (error) {
      console.error('Erro ao buscar artigos relacionados:', error);
      return [];
    }
  };

  return {
    loading,
    fetchCategories,
    fetchContentsByCategory,
    fetchContentBySlug,
    fetchVideosByContent,
    fetchRelatedContents,
    updateCategory,
    insertContent,
    updateContent,
    deleteContent,
    insertVideo,
    deleteVideo,
  };
}
