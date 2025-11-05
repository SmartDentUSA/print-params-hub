import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Brand, Model, Resin, ParameterSet } from '@/hooks/useSupabaseData';
import { toast } from '@/hooks/use-toast';

export const useSupabaseCRUD = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Brand CRUD operations
  const insertBrand = async (brand: Omit<Brand, 'id'>): Promise<Brand | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brands')
        .insert(brand)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar marca');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateBrand = async (id: string, updates: Partial<Brand>): Promise<Brand | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brands')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar marca');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteBrand = async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('brands')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar marca');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Model CRUD operations
  const insertModel = async (model: Omit<Model, 'id'>): Promise<Model | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('models')
        .insert(model)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar modelo');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateModel = async (id: string, updates: Partial<Model>): Promise<Model | null> => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('models')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar modelo';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteModel = async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('models')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar modelo');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Resin CRUD operations
  const insertResin = async (resin: Omit<Resin, 'id'>): Promise<Resin | null> => {
    try {
      setLoading(true);
      
      // Filtrar campos calculados que não existem no banco
      const { has_documents, ...dbResin } = resin as any;
      
      const { data, error } = await supabase
        .from('resins')
        .insert(dbResin)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar resina');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateResin = async (id: string, updates: Partial<Resin>): Promise<Resin | null> => {
    try {
      setLoading(true);
      
      // Filtrar campos calculados que não existem no banco
      const { has_documents, ...dbUpdates } = updates as any;
      
      const { data, error } = await supabase
        .from('resins')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar resina');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteResin = async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('resins')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar resina');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // ParameterSet CRUD operations
  const insertParameterSet = async (parameterSet: Omit<ParameterSet, 'id'>): Promise<ParameterSet | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('parameter_sets')
        .insert(parameterSet)
        .select()
        .single();
      
      if (error) {
        setError(error.message);
        throw error;
      }
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar conjunto de parâmetros';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const updateParameterSet = async (id: string, updates: Partial<ParameterSet>): Promise<ParameterSet | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('parameter_sets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        setError(error.message);
        throw error;
      }
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar conjunto de parâmetros';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const deleteParameterSet = async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('parameter_sets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar conjunto de parâmetros');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Resin Document CRUD operations
  const fetchResinDocuments = async (resinId: string): Promise<any[]> => {
    try {
      const { data, error } = await supabase
        .from('resin_documents')
        .select('*')
        .eq('resin_id', resinId)
        .eq('active', true)
        .order('order_index', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar documentos');
      return [];
    }
  };

  const insertResinDocument = async (doc: any): Promise<any | null> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('resin_documents')
        .insert(doc)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar documento');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const deleteResinDocument = async (id: string, fileUrl: string): Promise<boolean> => {
    try {
      setLoading(true);

      // Extract the file path from the URL
      const fileName = fileUrl.split('/').pop();
      if (!fileName) {
        throw new Error('Nome de arquivo inválido');
      }

      // Delete the file from storage FIRST and verify success
      const { error: storageError } = await supabase.storage
        .from('resin-documents')
        .remove([fileName]);

      if (storageError) {
        console.error('Erro ao deletar arquivo do storage:', storageError);
        throw new Error(`Falha ao remover arquivo: ${storageError.message}`);
      }

      // ONLY delete database record IF storage deletion was successful
      const { error: dbError } = await supabase
        .from('resin_documents')
        .delete()
        .eq('id', id);

      if (dbError) {
        console.error('Erro ao deletar registro do banco:', dbError);
        throw new Error(`Falha ao remover registro: ${dbError.message}`);
      }

      toast({
        title: "Documento removido",
        description: "O arquivo foi deletado com sucesso"
      });

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar documento');
      toast({
        title: "Erro ao deletar documento",
        description: err instanceof Error ? err.message : 'Erro desconhecido',
        variant: "destructive"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    insertBrand,
    updateBrand,
    deleteBrand,
    insertModel,
    updateModel,
    deleteModel,
    insertResin,
    updateResin,
    deleteResin,
    insertParameterSet,
    updateParameterSet,
    deleteParameterSet,
    fetchResinDocuments,
    insertResinDocument,
    deleteResinDocument,
    clearError: () => setError(null)
  };
};