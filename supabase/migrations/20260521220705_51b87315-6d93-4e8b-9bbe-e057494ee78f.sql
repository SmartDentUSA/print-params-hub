
-- =========================================================================
-- 1) Replace broad authenticated_full_access policies with admin-only
-- =========================================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'lead_product_history','lead_course_progress','lead_form_submissions',
    'lead_cart_history','lead_conversion_history','lead_sdr_interactions',
    'lead_activity_log','lead_opportunities','deals','interactions',
    'identity_keys','omie_parcelas','phone_dedup_log',
    'lia_attendances_backup_20260314','smartops_form_field_responses',
    'deal_status_history','omie_sync_cursors','cron_state','product_taxonomy'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS authenticated_full_access ON public.%I', t);
    EXECUTE format($f$
      CREATE POLICY admin_full_access ON public.%I
        AS PERMISSIVE FOR ALL TO authenticated
        USING (public.is_admin((SELECT auth.uid())))
        WITH CHECK (public.is_admin((SELECT auth.uid())))
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY service_role_all ON public.%I
        AS PERMISSIVE FOR ALL TO service_role
        USING (true) WITH CHECK (true)
    $f$, t);
  END LOOP;
END $$;

-- omie_notas_fiscais and omie_nf_items: tighten authenticated_read to admin
DROP POLICY IF EXISTS authenticated_read ON public.omie_notas_fiscais;
CREATE POLICY admin_read ON public.omie_notas_fiscais
  FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS authenticated_read ON public.omie_nf_items;
CREATE POLICY admin_read ON public.omie_nf_items
  FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- lead_enrichment_audit: tighten authenticated read to admin
DROP POLICY IF EXISTS "Authenticated read on lead_enrichment_audit" ON public.lead_enrichment_audit;
CREATE POLICY admin_read_enrichment_audit ON public.lead_enrichment_audit
  FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- =========================================================================
-- 2) Smartops courses/turmas/enrollments — restrict writes to admin
-- =========================================================================
DROP POLICY IF EXISTS auth_full_courses ON public.smartops_courses;
CREATE POLICY admin_write_courses ON public.smartops_courses
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS auth_full_turmas ON public.smartops_course_turmas;
CREATE POLICY admin_write_turmas ON public.smartops_course_turmas
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS auth_full_enrollments ON public.smartops_course_enrollments;
CREATE POLICY admin_write_enrollments ON public.smartops_course_enrollments
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS auth_full_companions ON public.smartops_enrollment_companions;
CREATE POLICY admin_write_companions ON public.smartops_enrollment_companions
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

-- smartops_turma_days: drop blanket auth policy if any
DROP POLICY IF EXISTS auth_full_turma_days ON public.smartops_turma_days;
CREATE POLICY admin_write_turma_days ON public.smartops_turma_days
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

-- smartops_turma_counters: only service_role
DROP POLICY IF EXISTS service_role_all_counters ON public.smartops_turma_counters;
CREATE POLICY service_role_all_counters ON public.smartops_turma_counters
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);
CREATE POLICY admin_read_counters ON public.smartops_turma_counters
  FOR SELECT TO authenticated
  USING (public.is_admin((SELECT auth.uid())));

-- =========================================================================
-- 3) Enable RLS on tables missing it + admin/service policies
-- =========================================================================
ALTER TABLE public.voice_message_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_voice_cache ON public.voice_message_cache
  FOR SELECT TO authenticated USING (public.is_admin((SELECT auth.uid())));
CREATE POLICY service_role_all_voice_cache ON public.voice_message_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.wa_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_wa_groups ON public.wa_groups
  FOR SELECT TO authenticated USING (public.is_admin((SELECT auth.uid())));
CREATE POLICY service_role_all_wa_groups ON public.wa_groups
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.wa_group_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_all_wa_schedules ON public.wa_group_schedules
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));
CREATE POLICY service_role_all_wa_schedules ON public.wa_group_schedules
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.wa_group_dispatch_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_wa_dispatch ON public.wa_group_dispatch_log
  FOR SELECT TO authenticated USING (public.is_admin((SELECT auth.uid())));
CREATE POLICY service_role_all_wa_dispatch ON public.wa_group_dispatch_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.wa_message_dedup ENABLE ROW LEVEL SECURITY;
CREATE POLICY service_role_all_wa_dedup ON public.wa_message_dedup
  FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.meta_lead_ingestion_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read_meta_log ON public.meta_lead_ingestion_log
  FOR SELECT TO authenticated USING (public.is_admin((SELECT auth.uid())));
CREATE POLICY service_role_all_meta_log ON public.meta_lead_ingestion_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =========================================================================
-- 4) technical_tickets: restrict update to service_role
-- =========================================================================
DROP POLICY IF EXISTS service_update_tickets ON public.technical_tickets;
CREATE POLICY service_update_tickets ON public.technical_tickets
  FOR UPDATE TO service_role
  USING (true) WITH CHECK (true);

-- =========================================================================
-- 5) Telemetry insert policies — restrict to service_role only
-- =========================================================================
DROP POLICY IF EXISTS service_insert ON public.ai_token_usage;
CREATE POLICY service_insert ON public.ai_token_usage
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS service_insert ON public.lead_state_events;
CREATE POLICY service_insert ON public.lead_state_events
  FOR INSERT TO service_role WITH CHECK (true);

DROP POLICY IF EXISTS service_insert_backfill ON public.backfill_log;
CREATE POLICY service_insert_backfill ON public.backfill_log
  FOR INSERT TO service_role WITH CHECK (true);

-- system_health_logs
DROP POLICY IF EXISTS service_insert_health ON public.system_health_logs;
DROP POLICY IF EXISTS service_insert ON public.system_health_logs;
DROP POLICY IF EXISTS public_insert ON public.system_health_logs;
CREATE POLICY service_insert_health ON public.system_health_logs
  FOR INSERT TO service_role WITH CHECK (true);

-- technical_ticket_messages
DROP POLICY IF EXISTS public_insert_ticket_msg ON public.technical_ticket_messages;
DROP POLICY IF EXISTS service_insert_ticket_msg ON public.technical_ticket_messages;
DROP POLICY IF EXISTS "Anyone can insert ticket messages" ON public.technical_ticket_messages;
CREATE POLICY service_insert_ticket_msg ON public.technical_ticket_messages
  FOR INSERT TO service_role WITH CHECK (true);

-- =========================================================================
-- 6) workflow_cell_mappings & opportunity_rules — restrict writes to admin
-- =========================================================================
DROP POLICY IF EXISTS "Authenticated can manage workflow_cell_mappings" ON public.workflow_cell_mappings;
DROP POLICY IF EXISTS "Anyone can manage workflow_cell_mappings" ON public.workflow_cell_mappings;
CREATE POLICY admin_manage_workflow_cell_mappings ON public.workflow_cell_mappings
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));

DROP POLICY IF EXISTS "Authenticated can manage opportunity_rules" ON public.opportunity_rules;
CREATE POLICY admin_manage_opportunity_rules ON public.opportunity_rules
  FOR ALL TO authenticated
  USING (public.is_admin((SELECT auth.uid())))
  WITH CHECK (public.is_admin((SELECT auth.uid())));
