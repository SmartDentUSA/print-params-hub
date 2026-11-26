CREATE INDEX IF NOT EXISTS idx_event_sales_deal_event ON public.event_sales (piperun_deal_id, event_id);
CREATE INDEX IF NOT EXISTS idx_deals_lead_ganha ON public.deals (lead_id) WHERE status = 'ganha';
CREATE INDEX IF NOT EXISTS idx_smartops_forms_name ON public.smartops_forms (name);