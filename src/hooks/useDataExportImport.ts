import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ImportStats {
  inserted: number;
  updated: number;
  errors: string[];
  total: number;
}

interface ValidationError {
  row: number;
  field: string;
  value: any;
  message: string;
}

const validateRow = (row: any, rowIndex: number): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validar resin_name
  const resinName = row.resin_name?.trim();
  if (!resinName || resinName.length < 2) {
    errors.push({
      row: rowIndex + 2, // +2 porque linha 1 é header e array começa em 0
      field: 'resin_name',
      value: row.resin_name,
      message: 'Nome da resina deve ter pelo menos 2 caracteres'
    });
  }

  // Validar resin_manufacturer
  if (!row.resin_manufacturer?.trim()) {
    errors.push({
      row: rowIndex + 2,
      field: 'resin_manufacturer',
      value: row.resin_manufacturer,
      message: 'Fabricante da resina é obrigatório'
    });
  }

  // Validar layer_height
  const layerHeight = parseFloat(row.layer_height);
  if (isNaN(layerHeight) || layerHeight <= 0 || layerHeight > 0.2) {
    errors.push({
      row: rowIndex + 2,
      field: 'layer_height',
      value: row.layer_height,
      message: 'Altura da camada deve estar entre 0 e 0.2mm'
    });
  }

  // Validar cure_time
  const cureTime = parseFloat(row.cure_time);
  if (isNaN(cureTime) || cureTime < 0.5 || cureTime > 120) {
    errors.push({
      row: rowIndex + 2,
      field: 'cure_time',
      value: row.cure_time,
      message: 'Tempo de cura deve estar entre 0.5 e 120 segundos'
    });
  }

  // Validar bottom_cure_time (obrigatório)
  const bottomCureTime = parseFloat(row.bottom_cure_time);
  if (isNaN(bottomCureTime) || bottomCureTime < 5 || bottomCureTime > 300) {
    errors.push({
      row: rowIndex + 2,
      field: 'bottom_cure_time',
      value: row.bottom_cure_time,
      message: 'Tempo de cura da base é obrigatório e deve estar entre 5 e 300 segundos'
    });
  }

  // Validar light_intensity
  const lightIntensity = parseInt(row.light_intensity);
  if (isNaN(lightIntensity) || lightIntensity < 1 || lightIntensity > 100) {
    errors.push({
      row: rowIndex + 2,
      field: 'light_intensity',
      value: row.light_intensity,
      message: 'Intensidade da luz deve estar entre 1 e 100%'
    });
  }

  // Validar bottom_layers
  if (row.bottom_layers) {
    const bottomLayers = parseInt(row.bottom_layers);
    if (isNaN(bottomLayers) || bottomLayers < 1 || bottomLayers > 20) {
      errors.push({
        row: rowIndex + 2,
        field: 'bottom_layers',
        value: row.bottom_layers,
        message: 'Camadas de base devem estar entre 1 e 20'
      });
    }
  }

  // Validar xy_adjustment_x_pct
  if (row.xy_adjustment_x_pct) {
    const xPct = parseInt(row.xy_adjustment_x_pct);
    if (isNaN(xPct) || xPct < 50 || xPct > 150) {
      errors.push({
        row: rowIndex + 2,
        field: 'xy_adjustment_x_pct',
        value: row.xy_adjustment_x_pct,
        message: 'Ajuste X deve estar entre 50 e 150%'
      });
    }
  }

  // Validar xy_adjustment_y_pct
  if (row.xy_adjustment_y_pct) {
    const yPct = parseInt(row.xy_adjustment_y_pct);
    if (isNaN(yPct) || yPct < 50 || yPct > 150) {
      errors.push({
        row: rowIndex + 2,
        field: 'xy_adjustment_y_pct',
        value: row.xy_adjustment_y_pct,
        message: 'Ajuste Y deve estar entre 50 e 150%'
      });
    }
  }

  // Validar lift_distance
  if (row.lift_distance) {
    const liftDist = parseFloat(row.lift_distance);
    if (isNaN(liftDist) || liftDist < 1 || liftDist > 20) {
      errors.push({
        row: rowIndex + 2,
        field: 'lift_distance',
        value: row.lift_distance,
        message: 'Distância de elevação deve estar entre 1 e 20mm'
      });
    }
  }

  // Validar lift_speed
  if (row.lift_speed) {
    const liftSpeed = parseFloat(row.lift_speed);
    if (isNaN(liftSpeed) || liftSpeed < 0.5 || liftSpeed > 10) {
      errors.push({
        row: rowIndex + 2,
        field: 'lift_speed',
        value: row.lift_speed,
        message: 'Velocidade de elevação deve estar entre 0.5 e 10mm/s'
      });
    }
  }

  // Validar retract_speed
  if (row.retract_speed) {
    const retractSpeed = parseFloat(row.retract_speed);
    if (isNaN(retractSpeed) || retractSpeed < 0.5 || retractSpeed > 10) {
      errors.push({
        row: rowIndex + 2,
        field: 'retract_speed',
        value: row.retract_speed,
        message: 'Velocidade de retração deve estar entre 0.5 e 10mm/s'
      });
    }
  }

  return errors;
};

export const useDataExportImport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bulkUpsertParameterSets = async (
    csvData: any[]
  ): Promise<ImportStats> => {
    const stats: ImportStats = { inserted: 0, updated: 0, errors: [], total: csvData.length };
    
    try {
      // Validar todas as linhas antes de processar
      const validationErrors: ValidationError[] = [];
      csvData.forEach((row, index) => {
        const rowErrors = validateRow(row, index);
        validationErrors.push(...rowErrors);
      });

      if (validationErrors.length > 0) {
        validationErrors.forEach(err => {
          stats.errors.push(`Linha ${err.row}, campo "${err.field}": ${err.message} (valor: "${err.value}")`);
        });
        return stats;
      }

      // Trim automático de strings e normalizar dados
      const normalizedData = csvData.map(row => ({
        ...row,
        brand_slug: row.brand_slug?.trim(),
        model_slug: row.model_slug?.trim(),
        resin_name: row.resin_name?.trim(),
        resin_manufacturer: row.resin_manufacturer?.trim(),
        notes: row.notes?.trim() || null
      }));

      // Separate rows with ID (update) from rows without ID (insert)
      const rowsToUpdate = normalizedData.filter(row => row.id && row.id.trim() !== '');
      const rowsToInsert = normalizedData.filter(row => !row.id || row.id.trim() === '');

      console.log(`Processando: ${rowsToUpdate.length} atualizações, ${rowsToInsert.length} inserções`);

      // Process updates with conflict detection
      for (const row of rowsToUpdate) {
        try {
          // Fetch existing record
          const { data: existingRecord, error: fetchError } = await supabase
            .from('parameter_sets')
            .select('*')
            .eq('id', row.id)
            .single();

          if (fetchError || !existingRecord) {
            stats.errors.push(`Registro ${row.id} não encontrado para atualização`);
            continue;
          }

          // Calculate natural key after merge
          const naturalKey = {
            brand_slug: row.brand_slug && row.brand_slug.trim() !== '' ? row.brand_slug : existingRecord.brand_slug,
            model_slug: row.model_slug && row.model_slug.trim() !== '' ? row.model_slug : existingRecord.model_slug,
            resin_name: row.resin_name && row.resin_name.trim() !== '' ? row.resin_name : existingRecord.resin_name,
            resin_manufacturer: row.resin_manufacturer && row.resin_manufacturer.trim() !== '' ? row.resin_manufacturer : existingRecord.resin_manufacturer,
            layer_height: row.layer_height && row.layer_height.trim() !== '' ? parseFloat(row.layer_height) : existingRecord.layer_height
          };

          // Check if another record with different ID has the same natural key
          const { data: conflictingRecords } = await supabase
            .from('parameter_sets')
            .select('id')
            .eq('brand_slug', naturalKey.brand_slug)
            .eq('model_slug', naturalKey.model_slug)
            .eq('resin_name', naturalKey.resin_name)
            .eq('resin_manufacturer', naturalKey.resin_manufacturer)
            .eq('layer_height', naturalKey.layer_height)
            .neq('id', row.id);

          if (conflictingRecords && conflictingRecords.length > 0) {
            stats.errors.push(
              `CONFLITO: ID ${row.id} - Parâmetros ${naturalKey.brand_slug}/${naturalKey.model_slug}/${naturalKey.resin_name}/${naturalKey.layer_height}mm já existem em outro registro (ID: ${conflictingRecords[0].id})`
            );
            continue;
          }

          // Merge data: use CSV value if present (and not empty), otherwise keep existing
          const mergedData = {
            brand_slug: naturalKey.brand_slug,
            model_slug: naturalKey.model_slug,
            resin_name: naturalKey.resin_name,
            resin_manufacturer: naturalKey.resin_manufacturer,
            layer_height: naturalKey.layer_height,
            cure_time: row.cure_time && row.cure_time.trim() !== '' ? parseFloat(row.cure_time) : existingRecord.cure_time,
            bottom_cure_time: row.bottom_cure_time && row.bottom_cure_time.trim() !== '' ? parseFloat(row.bottom_cure_time) : existingRecord.bottom_cure_time,
            light_intensity: row.light_intensity && row.light_intensity.trim() !== '' ? parseInt(row.light_intensity) : existingRecord.light_intensity,
            bottom_layers: row.bottom_layers && row.bottom_layers.trim() !== '' ? parseInt(row.bottom_layers) : existingRecord.bottom_layers,
            lift_distance: row.lift_distance && row.lift_distance.trim() !== '' ? parseFloat(row.lift_distance) : existingRecord.lift_distance,
            lift_speed: row.lift_speed && row.lift_speed.trim() !== '' ? parseFloat(row.lift_speed) : existingRecord.lift_speed,
            retract_speed: row.retract_speed && row.retract_speed.trim() !== '' ? parseFloat(row.retract_speed) : existingRecord.retract_speed,
            anti_aliasing: row.anti_aliasing && row.anti_aliasing.trim() !== '' ? (row.anti_aliasing === 'true' || row.anti_aliasing === true) : existingRecord.anti_aliasing,
            xy_size_compensation: row.xy_size_compensation && row.xy_size_compensation.trim() !== '' ? parseFloat(row.xy_size_compensation) : existingRecord.xy_size_compensation,
            wait_time_before_cure: row.wait_time_before_cure && row.wait_time_before_cure.trim() !== '' ? parseFloat(row.wait_time_before_cure) : existingRecord.wait_time_before_cure,
            wait_time_after_cure: row.wait_time_after_cure && row.wait_time_after_cure.trim() !== '' ? parseFloat(row.wait_time_after_cure) : existingRecord.wait_time_after_cure,
            wait_time_after_lift: row.wait_time_after_lift && row.wait_time_after_lift.trim() !== '' ? parseFloat(row.wait_time_after_lift) : existingRecord.wait_time_after_lift,
            xy_adjustment_x_pct: row.xy_adjustment_x_pct && row.xy_adjustment_x_pct.trim() !== '' ? parseInt(row.xy_adjustment_x_pct) : existingRecord.xy_adjustment_x_pct,
            xy_adjustment_y_pct: row.xy_adjustment_y_pct && row.xy_adjustment_y_pct.trim() !== '' ? parseInt(row.xy_adjustment_y_pct) : existingRecord.xy_adjustment_y_pct,
            notes: row.notes && row.notes.trim() !== '' ? row.notes : existingRecord.notes,
            active: row.active && row.active.trim() !== '' ? (row.active === 'true' || row.active === true) : existingRecord.active
          };

          const { error: updateError } = await supabase
            .from('parameter_sets')
            .update(mergedData)
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

      // Process inserts with duplicate detection
      if (rowsToInsert.length > 0) {
        const actualInserts: any[] = [];
        const convertedToUpdates: any[] = [];

        // Check each insert for existing natural key
        for (const row of rowsToInsert) {
          const naturalKey = {
            brand_slug: row.brand_slug,
            model_slug: row.model_slug,
            resin_name: row.resin_name,
            resin_manufacturer: row.resin_manufacturer,
            layer_height: parseFloat(row.layer_height)
          };

          const { data: existing } = await supabase
            .from('parameter_sets')
            .select('id')
            .eq('brand_slug', naturalKey.brand_slug)
            .eq('model_slug', naturalKey.model_slug)
            .eq('resin_name', naturalKey.resin_name)
            .eq('resin_manufacturer', naturalKey.resin_manufacturer)
            .eq('layer_height', naturalKey.layer_height)
            .maybeSingle();

          if (existing) {
            convertedToUpdates.push({ ...row, id: existing.id });
          } else {
            actualInserts.push(row);
          }
        }

        if (convertedToUpdates.length > 0) {
          console.log(`Converted ${convertedToUpdates.length} inserts to updates (duplicates detected)`);
        }

        // Process converted updates
        for (const row of convertedToUpdates) {
          try {
            const updateData: any = {
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
              notes: row.notes || null
            };

            if (row.active !== undefined && row.active !== '') {
              updateData.active = row.active === 'true' || row.active === true;
            }

            const { error: updateError } = await supabase
              .from('parameter_sets')
              .update(updateData)
              .eq('id', row.id);

            if (updateError) {
              stats.errors.push(`Erro ao atualizar duplicata: ${updateError.message}`);
            } else {
              stats.updated++;
            }
          } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Erro desconhecido';
            stats.errors.push(`Erro ao processar duplicata: ${errorMsg}`);
          }
        }

        // Process actual inserts in batches
        const batchSize = 50;
        for (let i = 0; i < actualInserts.length; i += batchSize) {
          const batch = actualInserts.slice(i, i + batchSize);
          
          const formattedBatch = batch.map(row => {
            const insertData: any = {
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
              notes: row.notes || null
            };

            if (row.active !== undefined && row.active !== '') {
              insertData.active = row.active === 'true' || row.active === true;
            }

            return insertData;
          });

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
