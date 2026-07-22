-- Function to compute post-campaign conversions:
-- number of distinct leads that received the campaign and had a NEW deal created AFTER their send timestamp.
CREATE OR REPLACE FUNCTION public.fn_campaign_conversions(p_campaign_id uuid)
RETURNS TABLE(conversions integer, deals_created integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sends AS (
    SELECT DISTINCT ON (lead_id) lead_id, sent_at
    FROM public.campaign_send_log
    WHERE (campaign_id = p_campaign_id OR source_campaign_id = p_campaign_id)
      AND sent_at IS NOT NULL
    ORDER BY lead_id, sent_at ASC
  ),
  matched AS (
    SELECT d.lead_id, d.id AS deal_id
    FROM public.deals d
    JOIN sends s ON s.lead_id = d.lead_id
    WHERE d.created_at > s.sent_at
  )
  SELECT
    COALESCE((SELECT COUNT(DISTINCT lead_id) FROM matched), 0)::integer AS conversions,
    COALESCE((SELECT COUNT(*) FROM matched), 0)::integer AS deals_created;
$$;

GRANT EXECUTE ON FUNCTION public.fn_campaign_conversions(uuid) TO authenticated, service_role;