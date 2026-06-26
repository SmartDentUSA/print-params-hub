
ALTER TABLE public.system_integration_registry DROP CONSTRAINT IF EXISTS system_integration_registry_check_type_check;
ALTER TABLE public.system_integration_registry ADD CONSTRAINT system_integration_registry_check_type_check
  CHECK (check_type IN ('http_get','edge_invoke','log_count','file_exists','special'));
