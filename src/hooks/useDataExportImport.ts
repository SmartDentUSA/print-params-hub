import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ImportStats {
  inserted: number;
  updated: number;
  errors: string[];
  total: number;
}

export const useDataExportImport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bulkUpsertParameterSets = async (
    csvData: any[]
  ): Promise<ImportStats> => {
    const stats: ImportStats = { inserted: 0, updated: 0, errors: [], total: csvData.length };
    
    try {
      // Separate rows with ID (update) from rows without ID (insert)
      const rowsToUpdate = csvData.filter(row => row.id && row.id.trim() !== '');
      const rowsToInsert = csvData.filter(row => !row.id || row.id.trim() === '');

      console.log(`Processando: ${rowsToUpdate.length} atualizações, ${rowsToInsert.length} inserções`);

      // Process updates
      for (const row of rowsToUpdate) {
        try {
          const { error: updateError } = await supabase
            .from('parameter_sets')
            .update({
              brand_slug: row.brand_slug,
              model_slug: row.model_slug,
              resin_name: row.resin_name,
              resin_manufacturer: row.resin_manufacturer,
              layer_height: parseFloat(row.layer_height),
              cure_time: parseFloat(row.cure_time),
              bottom_cure_time: row.bottom_cure_time ? parseFloat(row.bottom_cure_time) : null,
              light_intensity: parseInt(row.light_intensity),
              bottom_layers: row.bottom_layers ? parseInt(row.bottom_layers) : null,
              lift_distance: row.lift_distance ? parseFloat(row.lift_distance) : null,
              lift_speed: row.lift_speed ? parseFloat(row.lift_speed) : null,
              retract_speed: row.retract_speed ? parseFloat(row.retract_speed) : null,
              anti_aliasing: row.anti_aliasing === 'true' || row.anti_aliasing === true,
              xy_size_compensation: row.xy_size_compensation ? parseFloat(row.xy_size_compensation) : null,
              wait_time_before_cure: row.wait_time_before_cure ? parseFloat(row.wait_time_before_cure) : null,
              wait_time_after_cure: row.wait_time_after_cure ? parseFloat(row.wait_time_after_cure) : null,
              wait_time_after_lift: row.wait_time_after_lift ? parseFloat(row.wait_time_after_lift) : null,
              xy_adjustment_x_pct: row.xy_adjustment_x_pct ? parseInt(row.xy_adjustment_x_pct) : null,
              xy_adjustment_y_pct: row.xy_adjustment_y_pct ? parseInt(row.xy_adjustment_y_pct) : null,
              notes: row.notes || null,
              active: row.active === 'true' || row.active === true
            })
            .eq('id', row.id);

          if (updateError) {
            stats.errors.push(`Erro ao atualizar ${row.id}: ${updateError.message}`);
          } else {
            stats.updated++;
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
          stats.errors.push(`Erro ao processar atualização: ${errorMsg}`);
        }
      }

      // Process inserts in batches
      if (rowsToInsert.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < rowsToInsert.length; i += batchSize) {
          const batch = rowsToInsert.slice(i, i + batchSize);
          
          const formattedBatch = batch.map(row => ({
            brand_slug: row.brand_slug,
            model_slug: row.model_slug,
            resin_name: row.resin_name,
            resin_manufacturer: row.resin_manufacturer,
            layer_height: parseFloat(row.layer_height),
            cure_time: parseFloat(row.cure_time),
            bottom_cure_time: row.bottom_cure_time ? parseFloat(row.bottom_cure_time) : null,
            light_intensity: parseInt(row.light_intensity),
            bottom_layers: row.bottom_layers ? parseInt(row.bottom_layers) : null,
            lift_distance: row.lift_distance ? parseFloat(row.lift_distance) : 5.0,
            lift_speed: row.lift_speed ? parseFloat(row.lift_speed) : 3.0,
            retract_speed: row.retract_speed ? parseFloat(row.retract_speed) : 3.0,
            anti_aliasing: row.anti_aliasing === 'true' || row.anti_aliasing === true,
            xy_size_compensation: row.xy_size_compensation ? parseFloat(row.xy_size_compensation) : 0.0,
            wait_time_before_cure: row.wait_time_before_cure ? parseFloat(row.wait_time_before_cure) : 0,
            wait_time_after_cure: row.wait_time_after_cure ? parseFloat(row.wait_time_after_cure) : 0,
            wait_time_after_lift: row.wait_time_after_lift ? parseFloat(row.wait_time_after_lift) : 0,
            xy_adjustment_x_pct: row.xy_adjustment_x_pct ? parseInt(row.xy_adjustment_x_pct) : 100,
            xy_adjustment_y_pct: row.xy_adjustment_y_pct ? parseInt(row.xy_adjustment_y_pct) : 100,
            notes: row.notes || null,
            active: row.active === 'true' || row.active === true
          }));

          const { error: insertError } = await supabase
            .from('parameter_sets')
            .insert(formattedBatch);

          if (insertError) {
            stats.errors.push(`Erro ao inserir lote ${i / batchSize + 1}: ${insertError.message}`);
          } else {
            stats.inserted += batch.length;
          }
        }
      }

      return stats;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMsg);
      stats.errors.push(errorMsg);
      return stats;
    }
  };

  const clearError = () => setError(null);

  return {
    loading,
    error,
    bulkUpsertParameterSets,
    clearError
  };
};
