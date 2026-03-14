CREATE OR REPLACE VIEW public.v_behavioral_health AS
SELECT 'lead_activity_log' AS tabela, COUNT(*) AS registros, MAX(event_timestamp) AS ultimo FROM public.lead_activity_log
UNION ALL
SELECT 'lead_product_history', COUNT(*), MAX(created_at) FROM public.lead_product_history
UNION ALL
SELECT 'lead_cart_history', COUNT(*), MAX(created_at) FROM public.lead_cart_history
UNION ALL
SELECT 'lead_course_progress', COUNT(*), MAX(updated_at) FROM public.lead_course_progress
UNION ALL
SELECT 'lead_form_submissions', COUNT(*), MAX(submitted_at) FROM public.lead_form_submissions
UNION ALL
SELECT 'lead_sdr_interactions', COUNT(*), MAX(contacted_at) FROM public.lead_sdr_interactions;