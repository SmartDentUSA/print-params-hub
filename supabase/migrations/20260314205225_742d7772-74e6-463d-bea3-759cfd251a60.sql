CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_form_unique 
ON public.lead_form_submissions (lead_id, form_type, form_id) 
WHERE form_id IS NOT NULL;