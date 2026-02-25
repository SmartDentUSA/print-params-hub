-- Add ultima_etapa_comercial to preserve the commercial stage before stagnation
-- This enables MQL/SAL/SQL classification based on CRM history
ALTER TABLE public.lia_attendances 
ADD COLUMN IF NOT EXISTS ultima_etapa_comercial text;

-- Add comment for documentation
COMMENT ON COLUMN public.lia_attendances.ultima_etapa_comercial IS 'Last commercial stage before entering stagnation funnel. Used for MQL/SAL/SQL classification.';