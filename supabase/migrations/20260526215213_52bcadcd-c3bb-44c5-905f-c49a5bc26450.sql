-- Fix Rayshape owners: restore deals incorrectly marked as deleted, and reassign deal of merged lead to canonical
UPDATE public.deals
SET is_deleted = false
WHERE piperun_deal_id IN ('58513700','59311370')
  AND is_deleted = true;

UPDATE public.deals
SET lead_id = 'a2440fc0-6081-43d2-8680-256b124c3568'
WHERE piperun_deal_id = '52559870'
  AND lead_id = '0472de47-9118-4613-9cf2-9fc47848b41a';