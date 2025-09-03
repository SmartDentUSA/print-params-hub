import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealParameterSet } from '@/data/realData';

export interface Brand {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  active: boolean;
}

export interface Model {
  id: string;
  brand_id: string;
  name: string;
  slug: string;
  image_url?: string;
  notes?: string;
  active: boolean;
}

export interface Resin {
  id: string;
  name: string;
  manufacturer: string;
  color?: string;
  type: 'standard' | 'flexible' | 'tough' | 'transparent' | 'biocompatible' | 'high_temp';
  active: boolean;
}

export interface ParameterSet {
  id: string;
  brand_slug: string;
  model_slug: string;
  resin_name: string;
  resin_manufacturer: string;
  layer_height: number;
  cure_time: number;
  light_intensity: number;
  bottom_layers?: number;
  bottom_cure_time?: number;
  lift_distance?: number;
  lift_speed?: number;
  retract_speed?: number;
  anti_aliasing?: boolean;
  xy_size_compensation?: number;
  wait_time_before_cure?: number;
  wait_time_after_cure?: number;
  wait_time_after_lift?: number;
  notes?: string;
  active: boolean;
}

export const useSupabaseData = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all brands
  const fetchBrands = async (): Promise<Brand[]> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar marcas');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch models by brand
  const fetchModelsByBrand = async (brandSlug: string): Promise<Model[]> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('models')
        .select(`
          *,
          brands!inner (slug)
        `)
        .eq('brands.slug', brandSlug)
        .eq('active', true)
        .order('name');
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar modelos');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Fetch parameter sets by model
  const fetchParametersByModel = async (modelSlug: string): Promise<ParameterSet[]> => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('parameter_sets')
        .select('*')
        .eq('model_slug', modelSlug)
        .eq('active', true)
        .order('resin_name', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar parâmetros');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Insert parameter sets (for CSV import)
  const insertParameterSets = async (parameterSets: RealParameterSet[]): Promise<boolean> => {
    try {
      setLoading(true);
      
      // Convert RealParameterSet to ParameterSet format
      const formattedData = parameterSets.map(param => ({
        brand_slug: param.brand?.toLowerCase().replace(/\s+/g, '-') || '',
        model_slug: param.model?.toLowerCase().replace(/\s+/g, '-') || '',
        resin_name: param.resin || '',
        resin_manufacturer: param.variant_label || 'Unknown',
        layer_height: parseFloat(param.altura_da_camada_mm?.toString() || '0.05'),
        cure_time: parseInt(param.tempo_cura_seg?.toString() || '8'),
        light_intensity: parseInt(param.intensidade_luz_pct?.toString() || '100'),
        bottom_layers: parseInt(param.camadas_transicao?.toString() || '5'),
        bottom_cure_time: parseInt(param.tempo_adesao_seg?.toString() || '60'),
        lift_distance: 5.0, // Default value
        lift_speed: 3.0, // Default value
        retract_speed: 3.0, // Default value
        xy_adjustment_x_pct: parseInt(param.ajuste_x_pct?.toString() || '100'),
        xy_adjustment_y_pct: parseInt(param.ajuste_y_pct?.toString() || '100'),
        xy_size_compensation: 0.0, // Default value
        anti_aliasing: true, // Default value
        wait_time_before_cure: 0, // Default value
        wait_time_after_cure: 0, // Default value
        wait_time_after_lift: 0, // Default value
        notes: param.notes || null
      }));

      const { error } = await supabase
        .from('parameter_sets')
        .upsert(formattedData, {
          onConflict: 'brand_slug,model_slug,resin_name,resin_manufacturer,layer_height'
        });
      
      if (error) throw error;
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao importar dados');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Get unique brands with count
  const getUniqueBrands = async () => {
    try {
      const { data, error } = await supabase
        .from('parameter_sets')
        .select('brand_slug')
        .eq('active', true);
      
      if (error) throw error;
      
      const uniqueBrands = [...new Set(data?.map(item => item.brand_slug) || [])];
      return uniqueBrands.map(slug => ({
        id: slug,
        name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        slug,
        active: true
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar marcas');
      return [];
    }
  };

  // Get models by brand from parameter_sets
  const getModelsByBrand = async (brandSlug: string) => {
    try {
      const { data, error } = await supabase
        .from('parameter_sets')
        .select('model_slug')
        .eq('brand_slug', brandSlug)
        .eq('active', true);
      
      if (error) throw error;
      
      const uniqueModels = [...new Set(data?.map(item => item.model_slug) || [])];
      return uniqueModels.map(slug => ({
        id: slug,
        brand_id: brandSlug,
        name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        slug,
        active: true
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar modelos');
      return [];
    }
  };

  // Get resins by model
  const getResinsByModel = async (modelSlug: string) => {
    try {
      const { data, error } = await supabase
        .from('parameter_sets')
        .select('*')
        .eq('model_slug', modelSlug)
        .eq('active', true)
        .gte('cure_time', 5)
        .order('resin_name');
      
      if (error) throw error;
      
      // Group by resin
      const resinsMap = new Map();
      data?.forEach(param => {
        const key = `${param.resin_name}-${param.resin_manufacturer}`;
        if (!resinsMap.has(key)) {
          resinsMap.set(key, {
            id: key,
            name: param.resin_name,
            manufacturer: param.resin_manufacturer,
            parameterSets: []
          });
        }
        
        // Map parameter data to component interface
        const mappedParam = {
          id: param.id,
          label: `${param.layer_height}mm - ${param.cure_time}s`,
          altura_da_camada_mm: param.layer_height,
          tempo_cura_seg: param.cure_time,
          tempo_adesao_seg: param.bottom_cure_time || 0,
          camadas_transicao: param.bottom_layers || 8,
          intensidade_luz_pct: param.light_intensity,
          ajuste_x_pct: param.xy_adjustment_x_pct || 100,
          ajuste_y_pct: param.xy_adjustment_y_pct || 100,
          notes: param.notes
        };
        
        resinsMap.get(key).parameterSets.push(mappedParam);
      });
      
      return Array.from(resinsMap.values());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar resinas');
      return [];
    }
  };

  return {
    loading,
    error,
    fetchBrands,
    fetchModelsByBrand,
    fetchParametersByModel,
    insertParameterSets,
    getUniqueBrands,
    getModelsByBrand,
    getResinsByModel,
    clearError: () => setError(null)
  };
};