CREATE POLICY "team_read_enrollments" ON public.smartops_course_enrollments FOR SELECT TO authenticated USING (public.fn_is_team_member());
CREATE POLICY "team_read_companions" ON public.smartops_enrollment_companions FOR SELECT TO authenticated USING (public.fn_is_team_member());
GRANT SELECT ON public.smartops_course_enrollments TO authenticated;
GRANT SELECT ON public.smartops_enrollment_companions TO authenticated;