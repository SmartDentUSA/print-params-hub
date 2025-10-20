import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Author {
  id: string;
  name: string;
  specialty?: string;
  photo_url?: string;
  mini_bio?: string;
  full_bio?: string;
  lattes_url?: string;
  website_url?: string;
  instagram_url?: string;
  youtube_url?: string;
  facebook_url?: string;
  linkedin_url?: string;
  twitter_url?: string;
  tiktok_url?: string;
  order_index: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export function useAuthors() {
  const [loading, setLoading] = useState(false);

  const fetchAuthors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('authors')
        .select('*')
        .eq('active', true)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching authors:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAuthors = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('authors')
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching all authors:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  const fetchAuthorById = async (id: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('authors')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching author:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const insertAuthor = async (author: Omit<Author, 'id' | 'created_at' | 'updated_at'>) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('authors')
        .insert(author)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error inserting author:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateAuthor = async (id: string, updates: Partial<Author>) => {
    setLoading(true);
    try {
      console.log('🔄 Atualizando autor:', id, 'com dados:', updates);
      
      const { data, error } = await supabase
        .from('authors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Autor atualizado com sucesso:', data);
      
      return data;
    } catch (error) {
      console.error('❌ Erro ao atualizar autor:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteAuthor = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('authors')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error deleting author:', error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    fetchAuthors,
    fetchAllAuthors,
    fetchAuthorById,
    insertAuthor,
    updateAuthor,
    deleteAuthor
  };
}
