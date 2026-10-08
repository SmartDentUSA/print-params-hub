CREATE OR REPLACE FUNCTION public.fn_deal_won_at(p_closed_at timestamp with time zone, p_piperun_updated_at timestamp with time zone)
 RETURNS timestamp with time zone LANGUAGE sql IMMUTABLE SET search_path TO 'public'
AS $function$ SELECT CASE
  WHEN p_closed_at IS NOT NULL AND p_closed_at = date_trunc('day', p_closed_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    THEN p_closed_at + interval '1 day' - interval '1 second'
  ELSE COALESCE(p_closed_at, p_piperun_updated_at) END $function$;