
-- 1. Remove permissive policies
DROP POLICY IF EXISTS campaign_segments_service ON public.campaign_segments;
DROP POLICY IF EXISTS leads_authenticated_select ON public.leads;
DROP POLICY IF EXISTS lia_attendances_select_authenticated ON public.lia_attendances;

-- 2. Enable RLS + admin-only policy on previously unprotected tables
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    '_csv_leads_check',
    'campaign_sms_responses',
    'crm_product_sales',
    'meta_lead_event_buffer',
    'piperun_stage_transitions',
    'reactivation_rules',
    'backfill_jobs',
    'reactivation_sequences',
    'short_links',
    'system_config',
    'tldv_meetings',
    'tldv_meeting_participants',
    'tldv_meeting_intelligence',
    'tldv_webhook_log',
    'wa_followup_queue',
    'wa_group_members',
    'whatsapp_send_queue'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    -- FORCE so even table owner respects RLS; service_role still bypasses RLS.
    EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Admins full access" ON public.%I FOR ALL TO authenticated USING (public.is_admin((SELECT auth.uid()))) WITH CHECK (public.is_admin((SELECT auth.uid())))',
      t
    );
  END LOOP;
END $$;
