import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface MaintenanceStats {
  affected: number;
  brands: number;
  models: number;
}

export function useAdminMaintenance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getInactiveStats = async (): Promise<MaintenanceStats> => {
    try {
      const { count: totalCount } = await supabase
        .from('parameter_sets')
        .select('id', { count: 'exact', head: true })
        .eq('active', false);

      const { data: brandData } = await supabase
        .from('parameter_sets')
        .select('brand_slug')
        .eq('active', false);

      const { data: modelData } = await supabase
        .from('parameter_sets')
        .select('model_slug')
        .eq('active', false);

      const uniqueBrands = new Set(brandData?.map(item => item.brand_slug) || []).size;
      const uniqueModels = new Set(modelData?.map(item => item.model_slug) || []).size;

      return {
        affected: totalCount || 0,
        brands: uniqueBrands,
        models: uniqueModels,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao obter estatísticas';
      setError(message);
      throw new Error(message);
    }
  };

  const reactivateAllInactive = async (): Promise<number> => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: updateError } = await supabase
        .from('parameter_sets')
        .update({ active: true })
        .eq('active', false)
        .select();

      if (updateError) throw updateError;

      return data?.length || 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao reativar parâmetros';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const reactivateInactiveSince = async (hours: number): Promise<number> => {
    setLoading(true);
    setError(null);

    try {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hours);
      const cutoff = cutoffDate.toISOString();

      const { data, error: updateError } = await supabase
        .from('parameter_sets')
        .update({ active: true })
        .eq('active', false)
        .or(`updated_at.gt.${cutoff},created_at.gt.${cutoff}`)
        .select();

      if (updateError) throw updateError;

      return data?.length || 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao reativar parâmetros recentes';
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setError(null);

  return {
    loading,
    error,
    getInactiveStats,
    reactivateAllInactive,
    reactivateInactiveSince,
    clearError,
  };
}
