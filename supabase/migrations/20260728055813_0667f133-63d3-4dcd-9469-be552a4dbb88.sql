CREATE OR REPLACE FUNCTION public.list_table_columns(p_table text)
RETURNS TABLE(column_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT c.column_name::text
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = p_table;
$$;

GRANT EXECUTE ON FUNCTION public.list_table_columns(text) TO service_role, authenticated;