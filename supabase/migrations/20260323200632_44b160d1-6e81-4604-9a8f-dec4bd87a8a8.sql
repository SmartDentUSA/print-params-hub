
-- Step 1: Null out orphan lead_ids that don't exist in lia_attendances
UPDATE public.agent_sessions 
SET lead_id = NULL 
WHERE lead_id IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM public.lia_attendances la WHERE la.id = agent_sessions.lead_id);

-- Step 2: Drop old FK referencing leads(id)
ALTER TABLE public.agent_sessions DROP CONSTRAINT IF EXISTS agent_sessions_lead_id_fkey;

-- Step 3: Add new FK referencing lia_attendances(id)
ALTER TABLE public.agent_sessions ADD CONSTRAINT agent_sessions_lead_id_fkey 
  FOREIGN KEY (lead_id) REFERENCES public.lia_attendances(id) ON DELETE SET NULL;
