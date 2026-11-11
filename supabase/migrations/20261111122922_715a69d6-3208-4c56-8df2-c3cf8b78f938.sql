CREATE OR REPLACE FUNCTION public.set_promotional_table_owner()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    -- Servidor (Copilot) grava com o autor já validado no código.
    IF coalesce(auth.role(), '') = 'service_role' AND NEW.created_by IS NOT NULL THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Authentication required';
  END IF;
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$function$;