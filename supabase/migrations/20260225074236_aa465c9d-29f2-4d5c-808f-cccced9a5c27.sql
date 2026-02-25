
-- Phase 2: Add profile enrichment fields to lia_attendances
ALTER TABLE public.lia_attendances
  ADD COLUMN IF NOT EXISTS software_cad text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS volume_mensal_pecas text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS principal_aplicacao text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.lia_attendances.software_cad IS 'CAD software used by the lead (e.g., exocad, 3Shape, Blender)';
COMMENT ON COLUMN public.lia_attendances.volume_mensal_pecas IS 'Monthly production volume (e.g., "50-100 peças", "menos de 10")';
COMMENT ON COLUMN public.lia_attendances.principal_aplicacao IS 'Primary application (e.g., provisórios, guias cirúrgicos, modelos)';
