CREATE OR REPLACE FUNCTION public.trg_deals_expand_proposal_items()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.piperun_deal_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.proposals IS NULL OR jsonb_typeof(NEW.proposals) <> 'array' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND coalesce(OLD.proposals::text,'') = coalesce(NEW.proposals::text,'')
     AND coalesce(OLD.closed_at, '-infinity'::timestamptz) = coalesce(NEW.closed_at, '-infinity'::timestamptz) THEN
    RETURN NEW;
  END IF;
  BEGIN
    PERFORM public.fn_expand_deal_proposals_to_items(NEW.piperun_deal_id::text);
  EXCEPTION WHEN OTHERS THEN
    -- Item expansion must never block the deal itself from being saved.
    RAISE WARNING 'expand proposal items failed for deal %: %', NEW.piperun_deal_id, SQLERRM;
  END;
  RETURN NEW;
END
$function$;