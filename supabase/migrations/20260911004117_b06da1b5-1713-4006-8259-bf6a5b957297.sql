CREATE OR REPLACE FUNCTION public.set_promotional_table_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_promotional_table_owner_before_insert
BEFORE INSERT ON public.promotional_tables
FOR EACH ROW EXECUTE FUNCTION public.set_promotional_table_owner();

DROP POLICY "Admins manage promotional tables" ON public.promotional_tables;
CREATE POLICY "Admins manage promotional tables" ON public.promotional_tables FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));