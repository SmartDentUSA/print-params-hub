
CREATE TABLE public.system_health_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  function_name text NOT NULL,
  severity text NOT NULL DEFAULT 'error',
  error_type text,
  lead_email text,
  lead_id uuid,
  details jsonb DEFAULT '{}'::jsonb,
  ai_analysis text,
  ai_suggested_action text,
  auto_remediated boolean NOT NULL DEFAULT false,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz
);

ALTER TABLE public.system_health_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_all" ON public.system_health_logs FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "admin_update" ON public.system_health_logs FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "admin_delete" ON public.system_health_logs FOR DELETE USING (is_admin(auth.uid()));
CREATE POLICY "service_insert" ON public.system_health_logs FOR INSERT WITH CHECK (true);

CREATE INDEX idx_system_health_logs_created ON public.system_health_logs (created_at DESC);
CREATE INDEX idx_system_health_logs_severity ON public.system_health_logs (severity);
CREATE INDEX idx_system_health_logs_resolved ON public.system_health_logs (resolved);
