WITH latest AS (
  SELECT DISTINCT ON (deal_id)
    deal_id,
    raw_payload->>'closed_at' AS closed_at,
    raw_payload->'lost_reason'->>'name' AS loss_reason
  FROM piperun_webhook_events
  WHERE raw_payload->>'status' = '3'
  ORDER BY deal_id, received_at DESC
)
UPDATE deals d
SET status = 'perdida',
    closed_at = COALESCE(d.closed_at, (l.closed_at)::timestamptz),
    loss_reason = COALESCE(d.loss_reason, l.loss_reason),
    updated_at = now()
FROM latest l
WHERE d.piperun_deal_id::text = l.deal_id
  AND d.status = 'aberta'
  AND l.deal_id IN ('25701227','30192649','35892066','37300943','41474604','54019389','55640816','56119517','56612756','59673939','59686654','59695730','59778793','60028351','60082359','60204775','60211645','60250741','60263116','61637416','61882671','61885705','62123548','62411382','63297971');