
-- Registry: catalog of monitored integrations
CREATE TABLE public.system_integration_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('webhook_in','api_out','edge_function','seo_asset')),
  check_type TEXT NOT NULL CHECK (check_type IN ('http_get','edge_invoke','log_count','file_exists')),
  target_url TEXT,
  edge_function_name TEXT,
  volume_source_table TEXT,
  volume_source_column TEXT DEFAULT 'created_at',
  volume_source_filter JSONB,
  stale_after_minutes INT DEFAULT 1440,
  expected_status INT DEFAULT 200,
  enabled BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_integration_registry TO authenticated;
GRANT ALL ON public.system_integration_registry TO service_role;
ALTER TABLE public.system_integration_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view integration registry"
  ON public.system_integration_registry FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages registry"
  ON public.system_integration_registry FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Checks: result history
CREATE TABLE public.system_integration_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_key TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL CHECK (status IN ('ok','degraded','down','inactive','unknown')),
  http_status INT,
  latency_ms INT,
  volume_24h INT,
  last_event_at TIMESTAMPTZ,
  error_message TEXT,
  details JSONB
);
CREATE INDEX idx_sic_key_checked ON public.system_integration_checks(integration_key, checked_at DESC);
GRANT SELECT ON public.system_integration_checks TO authenticated;
GRANT ALL ON public.system_integration_checks TO service_role;
ALTER TABLE public.system_integration_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view integration checks"
  ON public.system_integration_checks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role manages checks"
  ON public.system_integration_checks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Latest check per integration view
CREATE OR REPLACE VIEW public.system_integration_status AS
SELECT
  r.id, r.key, r.label, r.category, r.check_type, r.target_url, r.edge_function_name,
  r.stale_after_minutes, r.enabled, r.display_order, r.notes,
  c.checked_at AS last_checked_at,
  c.status, c.http_status, c.latency_ms, c.volume_24h, c.last_event_at, c.error_message
FROM public.system_integration_registry r
LEFT JOIN LATERAL (
  SELECT * FROM public.system_integration_checks
  WHERE integration_key = r.key
  ORDER BY checked_at DESC
  LIMIT 1
) c ON true;
GRANT SELECT ON public.system_integration_status TO authenticated;

-- Seed initial inventory
INSERT INTO public.system_integration_registry (key, label, category, check_type, target_url, edge_function_name, volume_source_table, stale_after_minutes, display_order, notes) VALUES
-- Webhooks IN
('webhook_meta_leads','Meta Lead Ads (webhook)','webhook_in','log_count',NULL,NULL,'meta_lead_ingestion_log',1440,10,'Recebe leadgen webhooks do Meta'),
('webhook_piperun','PipeRun (webhook)','webhook_in','log_count',NULL,NULL,'piperun_webhook_events',1440,20,'Eventos de deal/person do PipeRun'),
('webhook_sellflux','Sellflux (webhook)','webhook_in','log_count',NULL,NULL,'lead_form_submissions',2880,30,'Sellflux postback'),
('webhook_loja_integrada','Loja Integrada (polling/webhook)','webhook_in','log_count',NULL,NULL,'loja_integrada_orders',1440,40,'Pedidos e-commerce'),
('webhook_astron','Astron Academy (postback)','webhook_in','log_count',NULL,NULL,'astron_member_access',4320,50,'Acessos Astron'),
('webhook_evolution','Evolution WhatsApp (webhook)','webhook_in','log_count',NULL,NULL,'whatsapp_inbox',360,60,'Mensagens recebidas WA'),
('webhook_tldv','tldv (webhook)','webhook_in','log_count',NULL,NULL,'tldv_webhook_log',10080,70,'Meetings tldv'),

-- APIs OUT (edge functions ping)
('api_piperun_sync','PipeRun API (sync)','api_out','edge_invoke',NULL,'smart-ops-sync-piperun',NULL,1440,110,'Saída para PipeRun'),
('api_omie','Omie ERP API','api_out','log_count',NULL,NULL,'omie_notas_fiscais',2880,120,'Notas fiscais sincronizadas'),
('api_sellflux_out','Sellflux API (out)','api_out','log_count',NULL,NULL,'campaign_send_log',2880,130,NULL),
('api_evolution_send','Evolution WA (envio)','api_out','log_count',NULL,NULL,'wa_send_log',1440,140,'Mensagens enviadas WA'),
('api_google_business','Google Business Profile API','api_out','log_count',NULL,NULL,'google_reviews',10080,150,'Avaliações Google'),
('api_meta_capi','Meta Conversion API','api_out','log_count',NULL,NULL,'meta_capi_event_log',2880,160,'Eventos enviados ao Meta CAPI'),
('api_lovable_ai','Lovable AI Gateway','api_out','log_count',NULL,NULL,'ai_token_usage',1440,170,'Uso de tokens LLM'),
('api_pandavideo','PandaVideo API','api_out','log_count',NULL,NULL,'knowledge_videos',10080,180,NULL),

-- Edge functions críticas (log_count em system_health_logs por function)
('edge_ingest_lead','smart-ops-ingest-lead','edge_function','log_count',NULL,NULL,'lead_activity_log',1440,210,'Ingestão de leads'),
('edge_lia_assign','smart-ops-lia-assign','edge_function','log_count',NULL,NULL,'agent_interactions',1440,220,'Roteamento Dra. LIA'),
('edge_piperun_webhook','smart-ops-piperun-webhook','edge_function','log_count',NULL,NULL,'piperun_webhook_events',1440,230,NULL),
('edge_wa_dispatcher','wa-dispatcher','edge_function','log_count',NULL,NULL,'wa_send_log',1440,240,'Despachador WA queue'),
('edge_wa_group_blast','wa-group-blast','edge_function','log_count',NULL,NULL,'wa_group_dispatch_log',4320,250,'Disparo para grupos'),
('edge_cron_watchdog','system-watchdog-deepseek','edge_function','log_count',NULL,NULL,'system_health_logs',2880,260,'Watchdog DeepSeek'),

-- SEO assets
('seo_robots','robots.txt','seo_asset','http_get','https://admin.smartdent.com.br/robots.txt',NULL,NULL,NULL,310,NULL),
('seo_llms','llms.txt','seo_asset','http_get','https://admin.smartdent.com.br/llms.txt',NULL,NULL,NULL,320,NULL),
('seo_llms_full','llms-full.txt','seo_asset','http_get','https://admin.smartdent.com.br/llms-full.txt',NULL,NULL,NULL,330,NULL),
('seo_sitemap','sitemap.xml','seo_asset','http_get','https://admin.smartdent.com.br/sitemap.xml',NULL,NULL,NULL,340,NULL),
('seo_sitemap_index','sitemap-index.xml','seo_asset','http_get','https://admin.smartdent.com.br/sitemap-index.xml',NULL,NULL,NULL,350,NULL),
('seo_video_sitemap','video-sitemap','seo_asset','http_get','https://admin.smartdent.com.br/api/video-sitemap',NULL,NULL,NULL,360,'Endpoint dinâmico Vercel');
