UPDATE public.trigger_automations
SET action_config = action_config
      || jsonb_build_object('notify_team_member_id', 'a30e0abd-f616-4d54-bfbf-2207a563901d'),
    updated_at = now()
WHERE id = '459d2989-39ca-4717-867b-64c2fb20ac55';