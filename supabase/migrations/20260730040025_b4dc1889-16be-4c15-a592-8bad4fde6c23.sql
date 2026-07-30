CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_group_targets_updated_at ON public.post_group_targets;
CREATE TRIGGER trg_post_group_targets_updated_at
BEFORE UPDATE ON public.post_group_targets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_post_group_instance_config_updated_at ON public.post_group_instance_config;
CREATE TRIGGER trg_post_group_instance_config_updated_at
BEFORE UPDATE ON public.post_group_instance_config
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();