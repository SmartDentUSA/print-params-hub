CREATE OR REPLACE FUNCTION public.fn_backfill_activity_person_on_people()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.lead_activity_log lal
  SET person_id = NEW.id,
      company_id = COALESCE(lal.company_id, NEW.primary_company_id),
      identity_resolved_at = now()
  FROM public.lia_attendances l
  WHERE lal.person_id IS NULL
    AND lal.lead_id = l.id
    AND lal.created_at > now() - interval '7 days'
    AND (
      (NEW.piperun_person_id IS NOT NULL AND l.pessoa_piperun_id = NEW.piperun_person_id)
      OR (NULLIF(btrim(COALESCE(NEW.telefone_normalized,'')),'') IS NOT NULL
          AND l.telefone_normalized = NEW.telefone_normalized)
      OR (NULLIF(btrim(COALESCE(NEW.email,'')),'') IS NOT NULL
          AND lower(l.email) = lower(btrim(NEW.email)))
    );
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[fn_backfill_activity_person_on_people] %', SQLERRM;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_backfill_activity_person ON public.people;
CREATE TRIGGER trg_backfill_activity_person
AFTER INSERT ON public.people
FOR EACH ROW EXECUTE FUNCTION public.fn_backfill_activity_person_on_people();