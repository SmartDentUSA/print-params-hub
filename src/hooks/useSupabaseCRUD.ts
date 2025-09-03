import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Brand, Model, Resin, ParameterSet } from '@/hooks/useSupabaseData';

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
      console.log('updateModel called with id:', id, 'updates:', updates);
      const { data, error } = await supabase
        .from('models')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      console.log('updateModel success, returned data:', data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar modelo');
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
      const { data, error } = await supabase
        .from('resins')
        .insert(resin)
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
      const { data, error } = await supabase
        .from('resins')
        .update(updates)
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
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conjunto de parâmetros');
      return null;
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
      
      if (error) throw error;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar conjunto de parâmetros');
      return null;
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
    clearError: () => setError(null)
  };
};