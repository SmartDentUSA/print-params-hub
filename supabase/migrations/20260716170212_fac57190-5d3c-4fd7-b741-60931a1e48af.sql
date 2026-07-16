ALTER TABLE public.wa_message_queue
  ADD COLUMN IF NOT EXISTS sequence_no integer,
  ADD COLUMN IF NOT EXISTS node_id text;

WITH numbered AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY campaign_id, group_jid
           ORDER BY node_index ASC, scheduled_at ASC, created_at ASC, id ASC
         )::integer AS seq
  FROM public.wa_message_queue
)
UPDATE public.wa_message_queue q
SET sequence_no = n.seq
FROM numbered n
WHERE q.id = n.id
  AND q.sequence_no IS NULL;

WITH candidates AS (
  SELECT q.id,
         c.flow_json -> q.node_index ->> 'id' AS stable_node_id,
         row_number() OVER (
           PARTITION BY q.campaign_id, q.group_jid, c.flow_json -> q.node_index ->> 'id'
           ORDER BY CASE WHEN q.status = 'sent' THEN 0 ELSE 1 END,
                    q.sent_at NULLS LAST,
                    q.created_at ASC,
                    q.id ASC
         ) AS occurrence
  FROM public.wa_message_queue q
  JOIN public.wa_campaigns c ON c.id = q.campaign_id
  WHERE q.node_id IS NULL
    AND jsonb_typeof(c.flow_json) = 'array'
    AND (c.flow_json -> q.node_index ->> 'type') IS DISTINCT FROM 'promo_seq'
    AND NULLIF(c.flow_json -> q.node_index ->> 'id', '') IS NOT NULL
)
UPDATE public.wa_message_queue q
SET node_id = candidates.stable_node_id
FROM candidates
WHERE q.id = candidates.id
  AND candidates.occurrence = 1;

ALTER TABLE public.wa_message_queue
  ALTER COLUMN sequence_no SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_message_queue_campaign_group_sequence
  ON public.wa_message_queue (campaign_id, group_jid, sequence_no);

CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_message_queue_campaign_group_node
  ON public.wa_message_queue (campaign_id, group_jid, node_id)
  WHERE node_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_wa_message_queue_campaign_group_sequence
  ON public.wa_message_queue (campaign_id, group_jid, sequence_no);