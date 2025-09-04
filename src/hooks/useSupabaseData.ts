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
        lift_distance: 5.0,
        lift_speed: 3.0,
        retract_speed: 3.0,
        xy_adjustment_x_pct: parseInt(param.ajuste_x_pct?.toString() || '100'),
        xy_adjustment_y_pct: parseInt(param.ajuste_y_pct?.toString() || '100'),
        xy_size_compensation: 0.0,
        anti_aliasing: true,
        wait_time_before_cure: 0,
        wait_time_after_cure: 0,
        wait_time_after_lift: 0,
        notes: param.notes || null
      }));

      // Remove duplicatas baseado na chave única
      const uniqueData = formattedData.filter((item, index, array) => {
        const key = `${item.brand_slug}-${item.model_slug}-${item.resin_name}-${item.resin_manufacturer}-${item.layer_height}`;
        return array.findIndex(i => 
          `${i.brand_slug}-${i.model_slug}-${i.resin_name}-${i.resin_manufacturer}-${i.layer_height}` === key
        ) === index;
      });

      console.log(`Dados originais: ${formattedData.length}, Dados únicos: ${uniqueData.length}`);

      // 1. Inserir marcas únicas
      const uniqueBrands = [...new Set(uniqueData.map(item => item.brand_slug))];
      const brandsToInsert = uniqueBrands.map(slug => ({
        name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        slug: slug,
        active: true
      }));

      if (brandsToInsert.length > 0) {
        const { error: brandsError } = await supabase
          .from('brands')
          .upsert(brandsToInsert, { onConflict: 'slug' });
        
        if (brandsError) {
          console.error('Erro ao inserir marcas:', brandsError);
          throw brandsError;
        }
        console.log(`${brandsToInsert.length} marcas inseridas`);
      }

      // 2. Buscar brand_ids para os modelos
      const { data: brandsData } = await supabase
        .from('brands')
        .select('id, slug')
        .in('slug', uniqueBrands);

      const brandMap = new Map(brandsData?.map(brand => [brand.slug, brand.id]) || []);

      // 3. Inserir modelos únicos
      const uniqueModels = [...new Set(uniqueData.map(item => `${item.brand_slug}|${item.model_slug}`))];
      const modelsToInsert = uniqueModels.map(combined => {
        const [brandSlug, modelSlug] = combined.split('|');
        return {
          brand_id: brandMap.get(brandSlug),
          name: modelSlug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug: modelSlug,
          active: true
        };
      }).filter(model => model.brand_id); // Remove modelos sem marca válida

      if (modelsToInsert.length > 0) {
        const { error: modelsError } = await supabase
          .from('models')
          .upsert(modelsToInsert, { onConflict: 'brand_id,slug' });
        
        if (modelsError) {
          console.error('Erro ao inserir modelos:', modelsError);
          throw modelsError;
        }
        console.log(`${modelsToInsert.length} modelos inseridos`);
      }

      // 4. Inserir resinas únicas
      const uniqueResins = [...new Set(uniqueData.map(item => `${item.resin_name}|${item.resin_manufacturer}`))];
      const resinsToInsert = uniqueResins.map(combined => {
        const [name, manufacturer] = combined.split('|');
        return {
          name: name,
          manufacturer: manufacturer,
          type: 'standard' as const,
          active: true
        };
      });

      if (resinsToInsert.length > 0) {
        console.log('Inserting resins:', resinsToInsert.length);
        console.log('Sample resins:', resinsToInsert.slice(0, 3));
        
        // Insert in smaller batches to avoid conflicts
        const batchSize = 10;
        for (let i = 0; i < resinsToInsert.length; i += batchSize) {
          const batch = resinsToInsert.slice(i, i + batchSize);
          const { error: resinsError } = await supabase
            .from('resins')
            .upsert(batch, { 
              onConflict: 'name,manufacturer',
              ignoreDuplicates: false 
            });
          
          if (resinsError) {
            console.error('Erro ao inserir lote de resinas:', resinsError);
            console.error('Lote que falhou:', batch);
            // Don't throw, continue with other batches
          } else {
            console.log(`Lote ${i/batchSize + 1} de resinas inserido com sucesso`);
          }
        }
        console.log(`Processamento de ${resinsToInsert.length} resinas concluído`);
      }

      // 5. Inserir parâmetros em lotes pequenos
      const batchSize = 50;
      for (let i = 0; i < uniqueData.length; i += batchSize) {
        const batch = uniqueData.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('parameter_sets')
          .insert(batch);
        
        if (error) {
          console.error('Supabase error:', error);
          throw error;
        }
      }
      
      console.log(`Inserção bem-sucedida: ${uniqueData.length} registros de parâmetros`);
      
      // 6. Sincronizar resinas automaticamente após importação
      console.log('Iniciando sincronização automática das resinas...');
      const syncSuccess = await syncResinsFromParameters();
      if (syncSuccess) {
        console.log('Sincronização de resinas concluída com sucesso');
      } else {
        console.warn('Falha na sincronização de resinas, mas parâmetros foram importados');
      }
      
      // Aguardar um pouco para garantir que os dados sejam persistidos
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return true;
    } catch (err) {
      console.error('Erro na inserção:', err);
      setError(err instanceof Error ? err.message : 'Erro ao importar dados');
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Get unique brands with count - only active brands with active parameters
  const getUniqueBrands = async () => {
    try {
      // First, get unique brand slugs from active parameter sets
      const { data: paramData, error: paramError } = await supabase
        .from('parameter_sets')
        .select('brand_slug')
        .eq('active', true);
      
      if (paramError) throw paramError;
      
      const uniqueBrandSlugs = [...new Set(paramData?.map(item => item.brand_slug) || [])];
      
      if (uniqueBrandSlugs.length === 0) return [];
      
      // Then, get brand data only for active brands that have parameters
      const { data: brandData, error: brandError } = await supabase
        .from('brands')
        .select('id, name, slug, active')
        .in('slug', uniqueBrandSlugs)
        .eq('active', true);
      
      if (brandError) throw brandError;
      
      // Return only brands that are both active and have active parameters
      return (brandData || []).map(brand => ({
        id: brand.slug,
        name: brand.name,
        slug: brand.slug,
        active: brand.active
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar marcas');
      return [];
    }
  };

  // Get models by brand with proper image integration
  const getModelsByBrand = async (brandSlug: string) => {
    try {
      // First, get unique model slugs from parameter_sets
      const { data: paramData, error: paramError } = await supabase
        .from('parameter_sets')
        .select('model_slug')
        .eq('brand_slug', brandSlug)
        .eq('active', true);
      
      if (paramError) throw paramError;
      
      const uniqueModelSlugs = [...new Set(paramData?.map(item => item.model_slug) || [])];
      
      if (uniqueModelSlugs.length === 0) return [];
      
      // Then, get complete model information from models table
      const { data: modelsData, error: modelsError } = await supabase
        .from('models')
        .select('id, name, slug, image_url, notes, active')
        .in('slug', uniqueModelSlugs)
        .eq('active', true);
      
      if (modelsError) {
        console.warn('Could not fetch from models table:', modelsError.message);
        // Fallback to generated model data if models table doesn't have the data
        return uniqueModelSlugs.map(slug => ({
          id: slug,
          brand_id: brandSlug,
          name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          slug,
          active: true,
          image_url: undefined,
          notes: undefined
        }));
      }
      
      // Merge models table data with fallback for missing models
      const result = uniqueModelSlugs.map(slug => {
        const modelData = modelsData?.find(m => m.slug === slug);
        if (modelData) {
          return {
            id: modelData.id,
            brand_id: brandSlug,
            name: modelData.name,
            slug: modelData.slug,
            image_url: modelData.image_url,
            notes: modelData.notes,
            active: modelData.active
          };
        } else {
          // Fallback for models not in models table
          return {
            id: slug,
            brand_id: brandSlug,
            name: slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            slug,
            active: true,
            image_url: undefined,
            notes: undefined
          };
        }
      });
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar modelos');
      return [];
    }
  };

  // Get resins by model
  const getResinsByModel = async (modelSlug: string) => {
    try {
      console.log('Loading resins for model:', modelSlug);
      const { data, error } = await supabase
        .from('parameter_sets')
        .select('*')
        .eq('model_slug', modelSlug)
        .eq('active', true)
        .order('resin_name');
      
      console.log('Raw parameter data for model:', data?.length || 0, 'records');
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        console.log('No parameter sets found for model:', modelSlug);
        return [];
      }
      
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
          layer_height: param.layer_height,
          cure_time: param.cure_time,
          bottom_cure_time: param.bottom_cure_time || 0,
          bottom_layers: param.bottom_layers || 8,
          light_intensity: param.light_intensity,
          xy_adjustment_x_pct: param.xy_adjustment_x_pct || 100,
          xy_adjustment_y_pct: param.xy_adjustment_y_pct || 100,
          wait_time_before_cure: param.wait_time_before_cure || 0,
          wait_time_after_cure: param.wait_time_after_cure || 0,
          wait_time_after_lift: param.wait_time_after_lift || 0,
          notes: param.notes
        };
        
        resinsMap.get(key).parameterSets.push(mappedParam);
      });
      
      const result = Array.from(resinsMap.values());
      console.log('Processed resins for model:', result.length);
      console.log('Resin names:', result.map(r => r.name));
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar resinas');
      return [];
    }
  };

  // Sync resins from parameter_sets to resins table
  const syncResinsFromParameters = async (): Promise<boolean> => {
    try {
      console.log('Iniciando sincronização de resinas...');
      
      // Get all unique resins from parameter_sets
      const { data: paramData, error } = await supabase
        .from('parameter_sets')
        .select('resin_name, resin_manufacturer')
        .eq('active', true);
      
      if (error) {
        console.error('Erro ao buscar parâmetros para sincronização:', error);
        throw error;
      }
      
      if (!paramData || paramData.length === 0) {
        console.log('Nenhum parâmetro encontrado para sincronização');
        return true;
      }
      
      // Get existing resins to avoid duplicates
      const { data: existingResins } = await supabase
        .from('resins')
        .select('name, manufacturer');
      
      const existingKeys = new Set(
        (existingResins || []).map(r => `${r.name}|${r.manufacturer}`)
      );
      
      // Create unique resins list (excluding existing ones)
      const uniqueResins = [...new Set(paramData?.map(item => 
        `${item.resin_name}|${item.resin_manufacturer}`
      ) || [])];
      
      const resinsToInsert = uniqueResins
        .filter(key => !existingKeys.has(key))
        .map(combined => {
          const [name, manufacturer] = combined.split('|');
          return {
            name: name,
            manufacturer: manufacturer,
            type: 'standard' as const,
            active: true
          };
        });
      
      console.log(`Encontradas ${uniqueResins.length} resinas únicas, ${resinsToInsert.length} novas para inserir`);
      
      if (resinsToInsert.length === 0) {
        console.log('Todas as resinas já existem na tabela');
        return true;
      }
      
      // Insert in batches
      const batchSize = 20;
      let successCount = 0;
      
      for (let i = 0; i < resinsToInsert.length; i += batchSize) {
        const batch = resinsToInsert.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('resins')
          .insert(batch);
        
        if (insertError) {
          console.error(`Erro ao inserir lote ${i/batchSize + 1}:`, insertError);
          // Continue mesmo com erro para processar outros lotes
        } else {
          successCount += batch.length;
          console.log(`Lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(resinsToInsert.length/batchSize)} inserido com sucesso`);
        }
      }
      
      console.log(`Sincronização concluída: ${successCount}/${resinsToInsert.length} resinas inseridas`);
      return successCount > 0 || resinsToInsert.length === 0;
    } catch (err) {
      console.error('Erro na sincronização de resinas:', err);
      return false;
    }
  };

  // Fetch all models for admin interface
  const fetchAllModels = async (): Promise<Model[]> => {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('models')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao buscar modelos';
      setError(errorMessage);
      console.error('Error fetching models:', error);
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    error,
    fetchBrands,
    fetchModelsByBrand,
    fetchParametersByModel,
    fetchAllModels,
    insertParameterSets,
    getUniqueBrands,
    getModelsByBrand,
    getResinsByModel,
    syncResinsFromParameters,
    clearError: () => setError(null)
  };
};