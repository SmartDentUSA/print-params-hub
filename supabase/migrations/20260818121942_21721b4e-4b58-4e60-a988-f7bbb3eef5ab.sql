CREATE POLICY "auth_read_public_courses" ON public.smartops_courses
FOR SELECT TO authenticated
USING (active = true AND public_visible = true);

CREATE POLICY "auth_read_public_turmas" ON public.smartops_course_turmas
FOR SELECT TO authenticated
USING (active = true AND course_id IN (
  SELECT id FROM public.smartops_courses WHERE active = true AND public_visible = true
));

CREATE OR REPLACE FUNCTION public.fn_is_team_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE lower(tm.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

GRANT EXECUTE ON FUNCTION public.fn_is_team_member() TO authenticated;

CREATE OR REPLACE FUNCTION public.fn_agenda_drive_folders()
RETURNS TABLE (turma_id uuid, folder_id text, folder_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id,
         coalesce(t.drive_folder_id, t.factory_drive_folder_id),
         coalesce(t.drive_folder_url, t.factory_drive_folder_url)
  FROM public.smartops_course_turmas t
  WHERE t.active = true
    AND public.fn_is_team_member()
    AND coalesce(t.drive_folder_id, t.factory_drive_folder_id) IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.fn_agenda_drive_folders() TO authenticated;