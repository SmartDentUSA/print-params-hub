CREATE POLICY "cognitive_dispatch_state service only" ON public.cognitive_dispatch_state
  FOR ALL TO service_role USING (true) WITH CHECK (true);