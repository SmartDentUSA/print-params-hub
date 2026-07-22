
CREATE TABLE public.meta_sem_crm_reprocess_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  csv_row INTEGER NOT NULL,
  nome TEXT,
  email TEXT,
  telefone_raw TEXT,
  telefone_normalized TEXT,
  form_name TEXT,
  produto_interesse TEXT,
  created_time TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  canonical_id_before UUID,
  canonical_pipeline_before BIGINT,
  deal_vendas_id_after BIGINT,
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_msc_queue_status_sched ON public.meta_sem_crm_reprocess_queue(status, scheduled_at);
CREATE INDEX idx_msc_queue_email ON public.meta_sem_crm_reprocess_queue(email);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meta_sem_crm_reprocess_queue TO authenticated;
GRANT ALL ON public.meta_sem_crm_reprocess_queue TO service_role;

ALTER TABLE public.meta_sem_crm_reprocess_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage msc queue"
ON public.meta_sem_crm_reprocess_queue
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_msc_queue_updated_at
BEFORE UPDATE ON public.meta_sem_crm_reprocess_queue
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
