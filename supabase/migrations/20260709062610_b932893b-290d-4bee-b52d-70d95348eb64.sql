
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'agent_actions_log','agent_observations','agent_rules','agent_state',
    'lia_assign_note_dedup','piperun_stage_map_overrides',
    'cs_onboarding_mover_control','cs_onboarding_mover_queue',
    'briefing_locks',
    'cad_cadista_profiles','cad_requests','cad_quotes','cad_reviews',
    'cad_price_table','cad_referrals','cad_services','cad_course_unlocks',
    'classified_listings','dealers',
    'online_courses','online_course_modules','online_course_lessons',
    'astron_courses','astron_lessons','astron_modules','astron_member_access',
    'canva_templates','kb_assets',
    'platform_plan_log','platform_promotions','promotion_usage','smartpoints_ledger',
    'platform_subscriptions','referrals',
    'social_flows','social_sessions','social_sequence_enrollments','social_sequences',
    'social_broadcasts','social_hashtag_monitors','social_hashtag_posts_processados',
    'social_ig_mentions','social_posts','social_scheduled_posts','social_triggers',
    'social_proof_snippets','social_flow_midias','social_flow_respostas','social_flow_links_manuais',
    'social_contacts','stripe_license_actions','stripe_subscriptions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
      EXECUTE format('DROP POLICY IF EXISTS "Admins full access" ON public.%I', t);
      EXECUTE format(
        'CREATE POLICY "Admins full access" ON public.%I FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))',
        t
      );
    END IF;
  END LOOP;
END $$;
