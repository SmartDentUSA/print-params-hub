-- Add missing fields for complete parameter display
ALTER TABLE public.parameter_sets 
ADD COLUMN IF NOT EXISTS xy_adjustment_x_pct INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS xy_adjustment_y_pct INTEGER DEFAULT 100;