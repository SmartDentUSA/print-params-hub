-- Create RPC function to get brand distribution with parameter counts
CREATE OR REPLACE FUNCTION get_brand_distribution()
RETURNS TABLE (
  brand_name TEXT,
  parameter_count BIGINT,
  percentage NUMERIC
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.name as brand_name,
    COUNT(ps.id) as parameter_count,
    ROUND(COUNT(ps.id) * 100.0 / NULLIF((SELECT COUNT(*) FROM parameter_sets WHERE active = true), 0), 1) as percentage
  FROM brands b
  LEFT JOIN models m ON b.id = m.brand_id
  LEFT JOIN parameter_sets ps ON m.slug = ps.model_slug AND ps.active = true
  WHERE b.active = true AND m.active = true
  GROUP BY b.id, b.name
  HAVING COUNT(ps.id) > 0
  ORDER BY parameter_count DESC
  LIMIT 5;
END;
$$;